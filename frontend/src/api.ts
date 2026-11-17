import type { Book, Borrowing, Category, StaffSession } from "./types";

const apiBase = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";
let refreshInProgress: Promise<StaffSession | null> | null = null;

function makeRequest(path: string, init: RequestInit, token?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${apiBase}/api${path}`, { ...init, headers });
}

async function refreshSession(): Promise<StaffSession | null> {
  if (!refreshInProgress) {
    refreshInProgress = (async () => {
      try {
        const current = JSON.parse(sessionStorage.getItem("ana-staff-session") || "null") as StaffSession | null;
        if (!current?.refreshToken) return null;
        const response = await makeRequest("/staff/refresh", {
          method: "POST",
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        });
        if (!response.ok) return null;
        const result = await response.json() as { session: StaffSession };
        sessionStorage.setItem("ana-staff-session", JSON.stringify(result.session));
        return result.session;
      } finally {
        refreshInProgress = null;
      }
    })();
  }
  return refreshInProgress;
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
  let response = await makeRequest(path, init, token);
  if (response.status === 401 && token) {
    const refreshed = await refreshSession();
    if (refreshed) response = await makeRequest(path, init, refreshed.accessToken);
    else {
      sessionStorage.removeItem("ana-staff-session");
      window.dispatchEvent(new Event("staff-session-expired"));
    }
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new Error("The server returned an unexpected response. Please try again.");
  }
  const body = await response.json() as { error?: string } & T;
  if (!response.ok) throw new Error(body.error || "Something went wrong. Please try again.");
  return body;
}

export const api = {
  books: async () => {
    const result = await request<{ books: Book[]; borrowingEnabled: boolean }>("/books");
    if (!Array.isArray(result.books)) throw new Error("The catalog API returned an invalid book list.");
    return { books: result.books, borrowingEnabled: result.borrowingEnabled === true };
  },
  categories: async () => {
    const result = await request<{ categories: Category[] }>("/categories");
    if (!Array.isArray(result.categories)) throw new Error("The catalog API returned an invalid category list.");
    return { categories: result.categories };
  },
  borrow: (input: { bookId: string; borrowerName: string; borrowerContact: string }) =>
    request<{ borrowing: Pick<Borrowing, "id" | "status" | "dueDate"> }>("/borrowings", { method: "POST", body: JSON.stringify(input) }),
  login: (email: string, password: string) =>
    request<{ session: StaffSession }>("/staff/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  staffBooks: (token: string) => request<{ books: Book[] }>("/staff/books", {}, token),
  staffCategories: (token: string) => request<{ categories: Category[] }>("/staff/categories", {}, token),
  borrowings: (token: string) => request<{ borrowings: Borrowing[] }>("/staff/borrowings", {}, token),
  saveBook: (token: string, book: Partial<Book> & { title: string; author: string; categoryId: string }, id?: string) =>
    request<{ book: Book }>(id ? `/staff/books/${id}` : "/staff/books", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(book),
    }, token),
  deleteBook: (token: string, id: string) =>
    request<void>(`/staff/books/${id}`, { method: "DELETE" }, token),
  addCategory: (token: string, name: string) =>
    request<{ category: Category }>("/staff/categories", { method: "POST", body: JSON.stringify({ name }) }, token),
  renameCategory: (token: string, id: string, name: string) =>
    request<{ category: Category }>(`/staff/categories/${id}`, { method: "PUT", body: JSON.stringify({ name }) }, token),
  deleteCategory: (token: string, id: string) =>
    request<void>(`/staff/categories/${id}`, { method: "DELETE" }, token),
  uploadCover: async (token: string, file: File) => {
    const form = new FormData();
    form.append("cover", file);
    return request<{ coverImage: string }>("/staff/covers", { method: "POST", body: form }, token);
  },
  updateBorrowing: (token: string, id: string, action: "approve" | "reject" | "return") =>
    request<{ borrowing: Borrowing }>(`/staff/borrowings/${id}/${action}`, { method: "POST" }, token),
};
