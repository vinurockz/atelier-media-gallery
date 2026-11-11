import type { Book, BookElement, BookPage } from "@/types/book";
import { request } from "@/lib/api/request";

export function fetchBooks(): Promise<Book[]> {
  return request<Book[]>("/books");
}

export function createBook(title: string): Promise<Book> {
  return request<Book>("/books", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export type BookPatch = Partial<
  Pick<Book, "title" | "coverColor" | "pageLimit">
>;

export function updateBook(id: string, patch: BookPatch): Promise<Book> {
  return request<Book>(`/books/${id}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteBook(id: string): Promise<void> {
  return request<void>(`/books/${id}`, { method: "DELETE" });
}

export function fetchBookPages(bookId: string): Promise<BookPage[]> {
  return request<BookPage[]>(`/books/${bookId}/pages`);
}

export function createBookPage(bookId: string): Promise<BookPage> {
  return request<BookPage>(`/books/${bookId}/pages`, { method: "POST" });
}

export function updateBookPage(
  bookId: string,
  pageId: string,
  patch: { background?: string; elements?: BookElement[] },
): Promise<BookPage> {
  return request<BookPage>(`/books/${bookId}/pages/${pageId}`, {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}

export function deleteBookPage(bookId: string, pageId: string): Promise<void> {
  return request<void>(`/books/${bookId}/pages/${pageId}`, {
    method: "DELETE",
  });
}
