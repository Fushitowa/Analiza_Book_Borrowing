import cors from "cors";
import { randomUUID } from "node:crypto";
import express, { type ErrorRequestHandler, type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import type { PostgrestError } from "@supabase/supabase-js";
import { getAdminClient, getAuthClient, getPublicClient } from "./supabase.js";

type StaffRequest = Request & { staff?: { id: string; name: string; email: string; role: string } };
type AsyncRoute = (req: StaffRequest, res: Response, next: NextFunction) => Promise<void>;
const app = express();
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
      callback(new Error("Cover images must be JPG, PNG, or WebP."));
      return;
    }
    callback(null, true);
  },
});
const asyncRoute = (handler: AsyncRoute) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(handler(req as StaffRequest, res, next)).catch(next);

function text(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const result = value.trim();
  return result.length > 0 && result.length <= maximum ? result : null;
}

function errorStatus(error: PostgrestError): number {
  if (error.code === "23505") return 409;
  if (error.code === "P0002") return 404;
  if (["23503", "23514", "P0001", "22023", "22P02"].includes(error.code)) return 400;
  return 500;
}

function sendDatabaseError(res: Response, error: PostgrestError, fallback: string): void {
  const status = errorStatus(error);
  res.status(status).json({ error: status === 500 ? fallback : error.message });
}

function toBook(row: Record<string, unknown>) {
  const category = row.category as { id?: string; name?: string } | null;
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    description: row.description,
    category: category?.name ?? "",
    categoryId: row.category_id,
    coverImage: row.cover_image,
    rating: row.rating,
    totalCopies: row.total_copies,
    availableCopies: row.available_copies,
  };
}

function toBorrowing(row: Record<string, unknown>) {
  const book = row.book as { title?: string } | null;
  return {
    id: row.id,
    bookId: row.book_id,
    bookTitle: book?.title ?? "Book",
    borrowerName: row.borrower_name,
    borrowerContact: row.borrower_contact,
    borrowDate: row.borrow_date,
    dueDate: row.due_date,
    returnDate: row.return_date,
    status: row.status,
  };
}

async function requireStaff(req: StaffRequest, res: Response, next: NextFunction) {
  const authorization = req.header("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) {
    res.status(401).json({ error: "Please sign in with an authorized staff account." });
    return;
  }
  try {
    const { data: userData, error: authError } = await getAuthClient().auth.getUser(token);
    if (authError || !userData.user) {
      res.status(401).json({ error: "Your session has expired. Please sign in again." });
      return;
    }
    const { data: staff, error } = await getAdminClient()
      .from("staff")
      .select("user_id, name, email, role")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (error) throw error;
    if (!staff) {
      res.status(403).json({ error: "This account is not authorized for the staff portal." });
      return;
    }
    req.staff = { id: staff.user_id, name: staff.name, email: staff.email, role: staff.role };
    next();
  } catch (error) {
    next(error);
  }
}

app.disable("x-powered-by");
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
app.use(express.json({ limit: "100kb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: "draft-7", legacyHeaders: false }));

router.get("/health", (_req, res) => res.json({ status: "ok" }));

router.get("/books", asyncRoute(async (_req, res) => {
  const { data, error } = await getPublicClient()
    .from("books")
    .select("*, category:categories(id, name)")
    .order("created_at", { ascending: false });
  if (error) { sendDatabaseError(res, error, "Could not load the book catalog."); return; }
  res.json({
    books: (data ?? []).map((row) => toBook(row as Record<string, unknown>)),
    borrowingEnabled: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  });
}));

router.get("/categories", asyncRoute(async (_req, res) => {
  const { data, error } = await getPublicClient().from("categories").select("id, name").order("name");
  if (error) { sendDatabaseError(res, error, "Could not load book categories."); return; }
  res.json({ categories: data ?? [] });
}));

router.post("/borrowings", rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: "draft-7", legacyHeaders: false }), asyncRoute(async (req, res) => {
  const bookId = text(req.body?.bookId, 50);
  const borrowerName = text(req.body?.borrowerName, 100);
  const borrowerContact = text(req.body?.borrowerContact, 160);
  if (!bookId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(bookId) ||
      !borrowerName || borrowerName.length < 2 || !borrowerContact || borrowerContact.length < 5) {
    res.status(400).json({ error: "Enter a valid book, your name, and a way for staff to contact you." });
    return;
  }
  const { data, error } = await getAdminClient().rpc("create_borrowing_request", {
    p_book_id: bookId,
    p_borrower_name: borrowerName,
    p_borrower_contact: borrowerContact,
  });
  if (error) { sendDatabaseError(res, error, "Could not submit the borrowing request."); return; }
  const record = data as { id: string; status: string; due_date: string };
  res.status(201).json({ borrowing: { id: record.id, status: record.status, dueDate: record.due_date } });
}));

router.post("/staff/login", asyncRoute(async (req, res) => {
  const email = text(req.body?.email, 254);
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  if (!email || password.length < 1 || password.length > 256) {
    res.status(400).json({ error: "Enter your staff email and password." });
    return;
  }
  const { data, error } = await getAuthClient().auth.signInWithPassword({ email, password });
  if (error || !data.user || !data.session) {
    res.status(401).json({ error: "Email or password is incorrect." });
    return;
  }
  const { data: staff, error: staffError } = await getAdminClient()
    .from("staff").select("name, email, role").eq("user_id", data.user.id).maybeSingle();
  if (staffError) { sendDatabaseError(res, staffError, "Could not verify staff access."); return; }
  if (!staff) {
    res.status(403).json({ error: "This account is not authorized for the staff portal." });
    return;
  }
  res.json({ session: {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    name: staff.name,
    email: staff.email,
    role: staff.role,
  } });
}));

router.post("/staff/refresh", asyncRoute(async (req, res) => {
  const refreshToken = text(req.body?.refreshToken, 4096);
  if (!refreshToken) { res.status(400).json({ error: "Your session has expired. Please sign in again." }); return; }
  const { data, error } = await getAuthClient().auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.user || !data.session) {
    res.status(401).json({ error: "Your session has expired. Please sign in again." });
    return;
  }
  const { data: staff, error: staffError } = await getAdminClient()
    .from("staff").select("name, email, role").eq("user_id", data.user.id).maybeSingle();
  if (staffError) { sendDatabaseError(res, staffError, "Could not verify staff access."); return; }
  if (!staff) { res.status(403).json({ error: "This account is not authorized for the staff portal." }); return; }
  res.json({ session: {
    accessToken: data.session.access_token,
    refreshToken: data.session.refresh_token,
    name: staff.name,
    email: staff.email,
    role: staff.role,
  } });
}));

router.get("/staff/books", requireStaff, asyncRoute(async (_req, res) => {
  const { data, error } = await getAdminClient().from("books")
    .select("*, category:categories(id, name)").order("created_at", { ascending: false });
  if (error) { sendDatabaseError(res, error, "Could not load the inventory."); return; }
  res.json({ books: (data ?? []).map((row) => toBook(row as Record<string, unknown>)) });
}));

router.post("/staff/books", requireStaff, asyncRoute(async (req, res) => {
  const input = req.body ?? {};
  const title = text(input.title, 200);
  const author = text(input.author, 160);
  const description = typeof input.description === "string" && input.description.length <= 1000 ? input.description.trim() : null;
  const categoryId = text(input.categoryId, 50);
  const coverImage = input.coverImage === "" || input.coverImage == null ? null : text(input.coverImage, 2048);
  const rating = Number(input.rating);
  const totalCopies = Number(input.totalCopies);
  if (!title || !author || description === null || !categoryId || (input.coverImage && !coverImage) ||
      !Number.isFinite(rating) || rating < 0 || rating > 5 || !Number.isInteger(totalCopies) || totalCopies < 1 || totalCopies > 500) {
    res.status(400).json({ error: "Check the book details, category, rating, and copy count." });
    return;
  }
  const { data, error } = await getAdminClient().rpc("save_book_inventory", {
    p_book_id: null, p_title: title, p_author: author, p_description: description,
    p_category_id: categoryId, p_cover_image: coverImage, p_rating: rating, p_total_copies: totalCopies,
  }).single();
  if (error) { sendDatabaseError(res, error, "Could not add this book."); return; }
  const savedId = typeof data === "object" && data !== null && "id" in data && typeof data.id === "string" ? data.id : null;
  if (!savedId) { res.status(500).json({ error: "The book was saved but could not be loaded." }); return; }
  const { data: book, error: selectError } = await getAdminClient().from("books")
    .select("*, category:categories(id, name)").eq("id", savedId).single();
  if (selectError) { sendDatabaseError(res, selectError, "The book was saved but could not be loaded."); return; }
  res.status(201).json({ book: toBook(book as Record<string, unknown>) });
}));

router.put("/staff/books/:id", requireStaff, asyncRoute(async (req, res) => {
  const input = req.body ?? {};
  const title = text(input.title, 200);
  const author = text(input.author, 160);
  const description = typeof input.description === "string" && input.description.length <= 1000 ? input.description.trim() : null;
  const categoryId = text(input.categoryId, 50);
  const coverImage = input.coverImage === "" || input.coverImage == null ? null : text(input.coverImage, 2048);
  const rating = Number(input.rating);
  const totalCopies = Number(input.totalCopies);
  if (!title || !author || description === null || !categoryId || (input.coverImage && !coverImage) ||
      !Number.isFinite(rating) || rating < 0 || rating > 5 || !Number.isInteger(totalCopies) || totalCopies < 1 || totalCopies > 500) {
    res.status(400).json({ error: "Check the book details, category, rating, and copy count." });
    return;
  }
  const { data, error } = await getAdminClient().rpc("save_book_inventory", {
    p_book_id: req.params.id, p_title: title, p_author: author, p_description: description,
    p_category_id: categoryId, p_cover_image: coverImage, p_rating: rating, p_total_copies: totalCopies,
  }).single();
  if (error) { sendDatabaseError(res, error, "Could not update this book."); return; }
  const savedId = typeof data === "object" && data !== null && "id" in data && typeof data.id === "string" ? data.id : null;
  if (!savedId) { res.status(500).json({ error: "The book was updated but could not be loaded." }); return; }
  const { data: book, error: selectError } = await getAdminClient().from("books")
    .select("*, category:categories(id, name)").eq("id", savedId).single();
  if (selectError) { sendDatabaseError(res, selectError, "The book was saved but could not be loaded."); return; }
  res.json({ book: toBook(book as Record<string, unknown>) });
}));

router.delete("/staff/books/:id", requireStaff, asyncRoute(async (req, res) => {
  const { error } = await getAdminClient().from("books").delete().eq("id", req.params.id);
  if (error) { sendDatabaseError(res, error, "Could not delete this book."); return; }
  res.status(204).end();
}));

router.get("/staff/categories", requireStaff, asyncRoute(async (_req, res) => {
  const { data, error } = await getAdminClient().from("categories").select("id, name").order("name");
  if (error) { sendDatabaseError(res, error, "Could not load categories."); return; }
  res.json({ categories: data ?? [] });
}));

router.post("/staff/categories", requireStaff, asyncRoute(async (req, res) => {
  const name = text(req.body?.name, 60);
  if (!name || name.length < 2) { res.status(400).json({ error: "Category names must be 2–60 characters." }); return; }
  const { data, error } = await getAdminClient().from("categories").insert({ name }).select("id, name").single();
  if (error) { sendDatabaseError(res, error, "Could not create this category."); return; }
  res.status(201).json({ category: data });
}));

router.put("/staff/categories/:id", requireStaff, asyncRoute(async (req, res) => {
  const name = text(req.body?.name, 60);
  if (!name || name.length < 2) { res.status(400).json({ error: "Category names must be 2–60 characters." }); return; }
  const { data, error } = await getAdminClient().from("categories").update({ name })
    .eq("id", req.params.id).select("id, name").maybeSingle();
  if (error) { sendDatabaseError(res, error, "Could not rename this category."); return; }
  if (!data) { res.status(404).json({ error: "Category not found." }); return; }
  res.json({ category: data });
}));

router.delete("/staff/categories/:id", requireStaff, asyncRoute(async (req, res) => {
  const { error } = await getAdminClient().from("categories").delete().eq("id", req.params.id);
  if (error) { sendDatabaseError(res, error, "Could not delete this category. Remove its books first."); return; }
  res.status(204).end();
}));

router.post("/staff/covers", requireStaff, (req, res, next) => {
  upload.single("cover")(req, res, (error: unknown) => {
    if (error) { next(error); return; }
    next();
  });
}, asyncRoute(async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "Choose an image to upload." }); return; }
  const extension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[req.file.mimetype];
  if (!extension) { res.status(400).json({ error: "Cover images must be JPG, PNG, or WebP." }); return; }
  const path = `${randomUUID()}.${extension}`;
  const { data, error } = await getAdminClient().storage.from("book-covers")
    .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (error) {
    console.error("Cover upload failed:", error.message);
    res.status(500).json({ error: "Could not upload this cover image." });
    return;
  }
  const { data: publicUrl } = getAdminClient().storage.from("book-covers").getPublicUrl(data.path);
  res.status(201).json({ coverImage: publicUrl.publicUrl });
}));

router.get("/staff/borrowings", requireStaff, asyncRoute(async (_req, res) => {
  const { data, error } = await getAdminClient().from("borrowing_records")
    .select("*, book:books(title)").order("created_at", { ascending: false });
  if (error) { sendDatabaseError(res, error, "Could not load borrowing requests."); return; }
  res.json({ borrowings: (data ?? []).map((row) => toBorrowing(row as Record<string, unknown>)) });
}));

router.post("/staff/borrowings/:id/:action", requireStaff, asyncRoute(async (req, res) => {
  const action = req.params.action;
  if (!["approve", "reject", "return"].includes(action)) {
    res.status(400).json({ error: "Choose approve, reject, or return." });
    return;
  }
  const { data, error } = await getAdminClient().rpc("update_borrowing_request", {
    p_borrowing_id: req.params.id,
    p_action: action,
  });
  if (error) { sendDatabaseError(res, error, "Could not update this borrowing request."); return; }
  const { data: borrowing, error: selectError } = await getAdminClient().from("borrowing_records")
    .select("*, book:books(title)").eq("id", data.id).single();
  if (selectError) { sendDatabaseError(res, selectError, "The request was updated but could not be loaded."); return; }
  res.json({ borrowing: toBorrowing(borrowing as Record<string, unknown>) });
}));

app.use("/api", router);
app.use((_req, res) => res.status(404).json({ error: "That API endpoint was not found." }));

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error("API request failed:", error);
  const message = error instanceof Error ? error.message : "The request could not be completed.";
  if (message.includes("Missing required environment variable")) {
    res.status(503).json({ error: "The library service is not configured yet. Please try again later." });
    return;
  }
  if (message.includes("File too large")) {
    res.status(413).json({ error: "Cover images must be smaller than 5 MB." });
    return;
  }
  if (message.includes("Cover images must be JPG")) {
    res.status(400).json({ error: message });
    return;
  }
  res.status(500).json({ error: "The request could not be completed. Please try again." });
};
app.use(errorHandler);

export default app;
