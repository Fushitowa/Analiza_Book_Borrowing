export interface Book {
  id: string;
  title: string;
  author: string;
  description: string;
  category: string;
  categoryId: string;
  coverImage: string | null;
  rating: number;
  totalCopies: number;
  availableCopies: number;
}

export interface Category {
  id: string;
  name: string;
}

export interface Borrowing {
  id: string;
  bookId: string;
  bookTitle: string;
  borrowerName: string;
  borrowerContact: string;
  borrowDate: string;
  dueDate: string;
  returnDate: string | null;
  status: "pending" | "borrowed" | "rejected" | "returned";
}

export interface StaffSession {
  accessToken: string;
  refreshToken: string;
  name: string;
  email: string;
  role: string;
}
