import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, CircleAlert, Clock3,
  Layers3, LibraryBig, LoaderCircle, LogOut, Search, ShieldCheck, Sparkles,
  Star, Upload, Users, X,
} from "lucide-react";
import { api } from "./api";
import type { Book, Borrowing, Category, StaffSession } from "./types";

const initialCategories = [
  "Action", "Romance", "Horror", "Sci-Fi", "Fantasy", "Fiction",
  "Non-Fiction", "History", "Educational", "Children's Books",
];

function Cover({ book, className = "" }: { book: Pick<Book, "title" | "author" | "coverImage">; className?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={`book-cover ${className}`}>
      {book.coverImage && !failed ? (
        <img src={book.coverImage} alt={`Cover of ${book.title}`} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="cover-fallback">
          <BookOpen size={24} strokeWidth={1.4} />
          <strong>{book.title}</strong>
          <span>{book.author}</span>
        </div>
      )}
    </div>
  );
}

function PublicCatalog() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    let active = true;
    Promise.all([api.books(), api.categories()])
      .then(([bookResult, categoryResult]) => {
        if (!active) return;
        setBooks(bookResult.books);
        setCategories(categoryResult.categories);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "The catalog could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const categoryNames = categories.length ? categories.map((item) => item.name) : initialCategories;
  const visibleBooks = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return books.filter((book) =>
      (category === "All" || book.category === category) &&
      (!term || `${book.title} ${book.author} ${book.category}`.toLocaleLowerCase().includes(term)),
    );
  }, [books, category, query]);

  async function submitBorrowing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedBook) return;
    const form = new FormData(event.currentTarget);
    try {
      await api.borrow({
        bookId: selectedBook.id,
        borrowerName: String(form.get("borrowerName") ?? ""),
        borrowerContact: String(form.get("borrowerContact") ?? ""),
      });
      setBooks((current) => current.map((book) => book.id === selectedBook.id
        ? { ...book, availableCopies: Math.max(0, book.availableCopies - 1) }
        : book));
      setConfirmation(selectedBook.title);
      setSelectedBook(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Your request could not be submitted.";
      window.alert(message);
      if (message.toLowerCase().includes("available")) {
        setBooks((current) => current.map((book) => book.id === selectedBook.id ? { ...book, availableCopies: 0 } : book));
      }
    }
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Ana's Book Browse home">
          <span className="brand-mark"><BookOpen size={21} /></span>
          <span>Ana's <b>Book Browse</b></span>
        </a>
        <label className="searchbox">
          <Search size={18} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 100+ titles or authors..." aria-label="Search books" />
          {query && <button className="icon-button" onClick={() => setQuery("")} aria-label="Clear search"><X size={15} /></button>}
        </label>
        <a className="staff-link" href="/staff"><ShieldCheck size={16} /> Staff Portal <ArrowRight size={14} /></a>
      </header>

      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow"><Sparkles size={14} /> YOUR NEXT CHAPTER STARTS HERE</span>
            <h1>A good book is<br />a <em>good place</em> to be.</h1>
            <p>Find a little escape, a new idea, or a story that stays with you. Browse the shelves and borrow your next favorite read.</p>
            <a className="hero-cta" href="#catalog">Explore the collection <ArrowRight size={17} /></a>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="art-sun" />
            <div className="art-book art-book-one"><i /><i /><i /></div>
            <div className="art-book art-book-two"><i /><i /><i /></div>
            <div className="art-book art-book-three"><i /><i /><i /></div>
            <span className="art-note">a little time<br />for yourself</span>
            <span className="art-sparkle sparkle-one">✳</span><span className="art-sparkle sparkle-two">✳</span>
          </div>
          <div className="hero-bottom"><span>Curated with care, shared with everyone.</span><span>Scroll to browse <ChevronDown size={14} /></span></div>
        </section>

        <section id="catalog" className="catalog-section">
          <div className="section-heading">
            <div><span className="eyebrow muted-eyebrow">THE LIBRARY</span><h2>Find your next favorite</h2></div>
            <span className="book-count">{loading ? "Loading titles…" : `${visibleBooks.length} ${visibleBooks.length === 1 ? "book" : "books"} to explore`}</span>
          </div>
          <nav className="category-list" aria-label="Book categories">
            {["All", ...categoryNames].map((name) => (
              <button key={name} className={`category-chip ${category === name ? "active" : ""}`} onClick={() => setCategory(name)}>{name}</button>
            ))}
          </nav>

          {loading && <div className="state-panel"><LoaderCircle className="spin" size={24} /> Opening the library…</div>}
          {!loading && loadError && <div className="state-panel error-panel"><CircleAlert size={20} /><span>{loadError}</span><button className="text-button" onClick={() => window.location.reload()}>Try again</button></div>}
          {!loading && !loadError && visibleBooks.length > 0 && (
            <div className="book-grid">
              {visibleBooks.map((book) => (
                <article className="book-card" key={book.id}>
                  <div className="card-cover-wrap">
                    <Cover book={book} />
                    <span className={`availability ${book.availableCopies > 0 ? "available" : "unavailable"}`}>
                      <span />{book.availableCopies > 0 ? "Available" : "Borrowed"}
                    </span>
                  </div>
                  <div className="book-details">
                    <div className="book-meta"><span>{book.category}</span><span className="rating"><Star size={13} fill="currentColor" /> {Number(book.rating).toFixed(1)}</span></div>
                    <h3 title={book.title}>{book.title}</h3>
                    <p className="book-author">by {book.author}</p>
                    <p className="book-description">{book.description}</p>
                    <button className="borrow-button" disabled={book.availableCopies < 1} onClick={() => setSelectedBook(book)}>
                      {book.availableCopies > 0 ? <>Rent now <ArrowRight size={15} /></> : "Currently borrowed"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {!loading && !loadError && visibleBooks.length === 0 && (
            <div className="state-panel empty-panel"><Search size={23} /><strong>No books found</strong><span>Try a different search or category.</span><button className="text-button" onClick={() => { setQuery(""); setCategory("All"); }}>Clear filters</button></div>
          )}
        </section>
      </main>
      <footer className="footer"><a className="brand footer-brand" href="/"><span className="brand-mark"><BookOpen size={18} /></span><span>Ana's <b>Book Browse</b></span></a><span>Stories are better when shared.</span><a href="/staff">Staff Portal <ArrowRight size={13} /></a></footer>

      {selectedBook && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedBook(null); }}>
        <section className="borrow-modal" role="dialog" aria-modal="true" aria-labelledby="borrow-title">
          <button className="modal-close" onClick={() => setSelectedBook(null)} aria-label="Close"><X size={19} /></button>
          <div className="modal-book"><Cover book={selectedBook} /><div><span className="eyebrow muted-eyebrow">YOUR NEXT READ</span><h2 id="borrow-title">{selectedBook.title}</h2><p>by {selectedBook.author}</p><span className="availability available"><span /> Available to borrow</span></div></div>
          <p className="modal-description">{selectedBook.description}</p>
          <form className="borrow-form" onSubmit={submitBorrowing}>
            <label>Your name<input name="borrowerName" required minLength={2} maxLength={100} placeholder="e.g. Ana Santos" /></label>
            <label>Contact details<input name="borrowerContact" required minLength={5} maxLength={160} placeholder="Email address or phone number" /></label>
            <p className="form-note"><Clock3 size={14} /> Your borrowing request will be sent to library staff for approval.</p>
            <button className="borrow-button" type="submit">Send borrowing request <ArrowRight size={15} /></button>
          </form>
        </section>
      </div>}

      {confirmation && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setConfirmation(""); }}>
        <section className="confirmation-modal" role="dialog" aria-modal="true" aria-labelledby="confirmed-title">
          <button className="modal-close" onClick={() => setConfirmation("")} aria-label="Close"><X size={19} /></button>
          <div className="success-icon"><Check size={25} /></div><span className="eyebrow muted-eyebrow">REQUEST RECEIVED</span>
          <h2 id="confirmed-title">It's on its way.</h2><p>Your request for <b>{confirmation}</b> has been sent to the library. Staff will follow up using the contact details you provided.</p>
          <button className="borrow-button" onClick={() => setConfirmation("")}>Back to browsing <ArrowRight size={15} /></button>
        </section>
      </div>}
    </div>
  );
}

type BookDraft = { title: string; author: string; description: string; categoryId: string; coverImage: string; rating: string; totalCopies: string };
const emptyDraft: BookDraft = { title: "", author: "", description: "", categoryId: "", coverImage: "", rating: "4.5", totalCopies: "1" };

function StaffPortal() {
  const [session, setSession] = useState<StaffSession | null>(() => {
    try { return JSON.parse(sessionStorage.getItem("ana-staff-session") || "null") as StaffSession | null; } catch { return null; }
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [activeTab, setActiveTab] = useState<"books" | "requests" | "categories">("books");
  const [draft, setDraft] = useState<BookDraft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh(token: string) {
    const [bookResult, categoryResult, borrowingResult] = await Promise.all([
      api.staffBooks(token), api.staffCategories(token), api.borrowings(token),
    ]);
    setBooks(bookResult.books); setCategories(categoryResult.categories); setBorrowings(borrowingResult.borrowings);
  }
  useEffect(() => { if (session) refresh(session.accessToken).catch((error: unknown) => setNotice(error instanceof Error ? error.message : "Could not load the dashboard.")); }, [session]);
  useEffect(() => {
    const expireSession = () => setSession(null);
    window.addEventListener("staff-session-expired", expireSession);
    return () => window.removeEventListener("staff-session-expired", expireSession);
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoginBusy(true); setLoginError("");
    try {
      const result = await api.login(email, password);
      sessionStorage.setItem("ana-staff-session", JSON.stringify(result.session));
      setSession(result.session); setPassword("");
    } catch (error) { setLoginError(error instanceof Error ? error.message : "Sign-in failed."); }
    finally { setLoginBusy(false); }
  }
  function signOut() { sessionStorage.removeItem("ana-staff-session"); setSession(null); setBooks([]); setBorrowings([]); }

  async function saveBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session || !draft) return;
    setBusy(true); setNotice("");
    try {
      const data = { ...draft, rating: Number(draft.rating), totalCopies: Number(draft.totalCopies) };
      await api.saveBook(session.accessToken, data, editingId ?? undefined);
      await refresh(session.accessToken); setDraft(null); setEditingId(null); setNotice("Book saved.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Could not save this book."); }
    finally { setBusy(false); }
  }
  async function removeBook(book: Book) {
    if (!session || !window.confirm(`Delete "${book.title}"? This can't be undone.`)) return;
    try { await api.deleteBook(session.accessToken, book.id); await refresh(session.accessToken); setNotice("Book deleted."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete this book."); }
  }
  async function addCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!session) return;
    try { await api.addCategory(session.accessToken, newCategory); setNewCategory(""); await refresh(session.accessToken); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not add that category."); }
  }
  async function changeCategory(category: Category) {
    if (!session) return;
    const name = window.prompt("Update category name", category.name)?.trim();
    if (!name || name === category.name) return;
    try { await api.renameCategory(session.accessToken, category.id, name); await refresh(session.accessToken); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not rename this category."); }
  }
  async function removeCategory(category: Category) {
    if (!session || !window.confirm(`Delete the "${category.name}" category?`)) return;
    try { await api.deleteCategory(session.accessToken, category.id); await refresh(session.accessToken); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Could not delete this category."); }
  }
  async function updateRequest(item: Borrowing, action: "approve" | "reject" | "return") {
    if (!session) return;
    setBusy(true);
    try {
      await api.updateBorrowing(session.accessToken, item.id, action);
      await refresh(session.accessToken);
      setNotice(action === "approve" ? "Request approved." : action === "reject" ? "Request rejected." : "Book marked as returned.");
    }
    catch (error) { setNotice(error instanceof Error ? error.message : `Could not ${action} this request.`); }
    finally { setBusy(false); }
  }

  if (!session) return <div className="staff-login-page">
    <a className="back-link" href="/"><ArrowLeft size={16} /> Back to the catalog</a>
    <div className="login-card"><span className="brand-mark"><ShieldCheck size={22} /></span><span className="eyebrow muted-eyebrow">ANA'S BOOK BROWSE</span>
      <h1>Staff Portal</h1><p>Sign in with your authorized staff account to manage the library.</p>
      <form className="borrow-form" onSubmit={signIn}>
        <label>Email address<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@library.com" /></label>
        <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label>
        {loginError && <p className="inline-error"><CircleAlert size={15} />{loginError}</p>}
        <button className="borrow-button" disabled={loginBusy}>{loginBusy ? <LoaderCircle className="spin" size={17} /> : "Sign in"} {!loginBusy && <ArrowRight size={15} />}</button>
      </form><span className="login-footnote"><ShieldCheck size={13} /> Authorized staff only</span>
    </div>
  </div>;

  const pendingCount = borrowings.filter((item) => item.status === "pending").length;
  return <div className="dashboard">
    <aside className="dashboard-sidebar">
      <a className="brand" href="/"><span className="brand-mark"><BookOpen size={20} /></span><span>Ana's <b>Book Browse</b></span></a>
      <div className="sidebar-label">LIBRARY MANAGEMENT</div>
      <button className={`side-link ${activeTab === "books" ? "selected" : ""}`} onClick={() => setActiveTab("books")}><LibraryBig size={18} /> Books</button>
      <button className={`side-link ${activeTab === "requests" ? "selected" : ""}`} onClick={() => setActiveTab("requests")}><Users size={18} /> Borrowing requests{pendingCount > 0 && <span className="side-count">{pendingCount}</span>}</button>
      <button className={`side-link ${activeTab === "categories" ? "selected" : ""}`} onClick={() => setActiveTab("categories")}><Layers3 size={18} /> Categories</button>
      <div className="sidebar-bottom"><span><span className="online-dot" /> Signed in as <b>{session.name}</b></span><button className="side-link" onClick={signOut}><LogOut size={17} /> Sign out</button></div>
    </aside>
    <main className="dashboard-main">
      <header className="dashboard-header"><div><span className="eyebrow muted-eyebrow">STAFF DASHBOARD</span><h1>{activeTab === "books" ? "Book inventory" : activeTab === "requests" ? "Borrowing requests" : "Book categories"}</h1></div><a className="back-link" href="/"><ArrowLeft size={15} /> Public catalog</a></header>
      <div className="dashboard-stats"><div><span><LibraryBig size={17} /> Total titles</span><b>{books.length}</b></div><div><span><Check size={17} /> Available copies</span><b>{books.reduce((sum, book) => sum + book.availableCopies, 0)}</b></div><div><span><Clock3 size={17} /> Pending requests</span><b>{pendingCount}</b></div></div>
      {notice && <div className="dashboard-notice"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15} /></button></div>}
      {activeTab === "books" && <section className="dashboard-panel">
        <div className="panel-heading"><div><h2>All books</h2><p>Add, update, and keep track of your shelves.</p></div><button className="borrow-button compact" onClick={() => { setEditingId(null); setDraft({ ...emptyDraft, categoryId: categories[0]?.id ?? "" }); }}>+ Add a book</button></div>
        {draft && <form className="book-editor" onSubmit={saveBook}>
          <div className="editor-title"><h3>{editingId ? "Edit book" : "Add a new book"}</h3><button type="button" className="icon-button" onClick={() => { setDraft(null); setEditingId(null); }} aria-label="Close form"><X size={17} /></button></div>
          <div className="editor-grid">
            <label>Title<input required maxLength={200} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label>Author<input required maxLength={160} value={draft.author} onChange={(event) => setDraft({ ...draft, author: event.target.value })} /></label>
            <label>Category<select required value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}><option value="">Choose a category</option>{categories.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></label>
            <label>Rating<input type="number" min="0" max="5" step="0.1" value={draft.rating} onChange={(event) => setDraft({ ...draft, rating: event.target.value })} /></label>
            <label>Total copies<input type="number" min="1" max="500" required value={draft.totalCopies} onChange={(event) => setDraft({ ...draft, totalCopies: event.target.value })} /></label>
            <label>Cover image URL<input value={draft.coverImage} onChange={(event) => setDraft({ ...draft, coverImage: event.target.value })} placeholder="https://…" /></label>
            <label className="editor-wide">Description<textarea maxLength={1000} rows={3} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
            <label className="upload-field"><Upload size={15} /> Upload a cover image<input type="file" accept="image/jpeg,image/png,image/webp" onChange={async (event) => {
              const file = event.target.files?.[0]; if (!file) return;
              try { const result = await api.uploadCover(session.accessToken, file); setDraft((current) => current ? { ...current, coverImage: result.coverImage } : current); }
              catch (error) { setNotice(error instanceof Error ? error.message : "Upload failed."); }
            }} /></label>
          </div>
          <button className="borrow-button compact" disabled={busy || !draft.categoryId}>{busy ? "Saving…" : "Save book"} <ArrowRight size={14} /></button>
        </form>}
        <div className="inventory-table"><div className="table-head"><span>BOOK</span><span>CATEGORY</span><span>COPIES</span><span>STATUS</span><span>ACTIONS</span></div>
          {books.map((book) => <div className="table-row" key={book.id}><div className="inventory-title"><Cover book={book} /><span><b>{book.title}</b><small>{book.author}</small></span></div><span>{book.category}</span><span>{book.availableCopies} / {book.totalCopies}</span><span className={`table-status ${book.availableCopies ? "in-stock" : "out-stock"}`}>{book.availableCopies ? "Available" : "Borrowed"}</span><span className="row-actions"><button onClick={() => { setEditingId(book.id); setDraft({ title: book.title, author: book.author, description: book.description, categoryId: book.categoryId, coverImage: book.coverImage ?? "", rating: String(book.rating), totalCopies: String(book.totalCopies) }); }}>Edit</button><button className="danger-text" onClick={() => removeBook(book)}>Delete</button></span></div>)}
          {!books.length && <div className="empty-table">No books yet. Add a title to get started.</div>}
        </div>
      </section>}
      {activeTab === "requests" && <section className="dashboard-panel"><div className="panel-heading"><div><h2>Requests from readers</h2><p>Approve requests, or mark returned books back on the shelf.</p></div></div>
        <div className="request-list">{borrowings.map((item) => <article className="request-card" key={item.id}><div><span className={`request-status ${item.status}`}>{item.status}</span><h3>{item.bookTitle}</h3><p>{item.borrowerName} <span>·</span> {item.borrowerContact}</p><small>Requested {new Date(item.borrowDate).toLocaleDateString()} · Due {new Date(item.dueDate).toLocaleDateString()}</small></div>
          <div className="request-actions">{item.status === "pending" && <><button disabled={busy} onClick={() => updateRequest(item, "approve")}>Approve</button><button className="danger-text" disabled={busy} onClick={() => updateRequest(item, "reject")}>Reject</button></>}{item.status === "borrowed" && <button disabled={busy} onClick={() => updateRequest(item, "return")}>Mark returned</button>}</div>
        </article>)}{borrowings.length === 0 && <div className="empty-table">No borrowing requests yet.</div>}</div>
      </section>}
      {activeTab === "categories" && <section className="dashboard-panel"><div className="panel-heading"><div><h2>Categories</h2><p>Organize your books so readers can find just what they love.</p></div></div>
        <form className="category-add" onSubmit={addCategory}><input required minLength={2} maxLength={60} value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="New category name" /><button className="borrow-button compact">Add category <ArrowRight size={14} /></button></form>
        <div className="staff-category-list">{categories.map((item) => <div className="staff-category" key={item.id}><span>{item.name}</span><div><button onClick={() => changeCategory(item)}>Rename</button><button className="danger-text" onClick={() => removeCategory(item)}>Delete</button></div></div>)}</div>
      </section>}
      <footer className="dashboard-footer">Ana's Book Browse <span>·</span> Staff workspace</footer>
    </main>
  </div>;
}

export default function App() {
  const isStaff = window.location.pathname.startsWith("/staff");
  return isStaff ? <StaffPortal /> : <PublicCatalog />;
}
