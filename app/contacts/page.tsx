"use client";

import { useEffect, useState, useCallback } from "react";
import type { GHLContact, ContactsResponse } from "@/lib/ghl";

const PAGE_SIZE = 20;

function ContactCard({ contact }: { contact: GHLContact }) {
  const name =
    [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
    contact.email ||
    "Unnamed";

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-start gap-4 hover:shadow-md transition-shadow">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{name}</p>
        {contact.companyName && (
          <p className="text-sm text-gray-500 truncate">{contact.companyName}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="hover:text-indigo-600 truncate"
            >
              {contact.email}
            </a>
          )}
          {contact.phone && <span>{contact.phone}</span>}
        </div>
        {contact.tags && contact.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {contact.tags.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {contact.dateAdded && (
        <p className="flex-shrink-0 text-xs text-gray-400">
          {new Date(contact.dateAdded).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<GHLContact[]>([]);
  const [total, setTotal] = useState(0);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>(undefined);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<(string | undefined)[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setCurrentCursor(undefined);
      setNextCursor(undefined);
      setCursorHistory([]);
      setPageIndex(0);
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchPage = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
      });
      if (currentCursor) params.set("startAfterId", currentCursor);
      if (debouncedQuery) params.set("query", debouncedQuery);

      const res = await fetch(`/api/contacts?${params}`);
      const data: ContactsResponse & { error?: string } = await res.json();

      if (!res.ok) throw new Error(data.error ?? "Failed to fetch contacts");

      setContacts(data.contacts ?? []);
      setTotal(data.meta?.total ?? 0);
      setNextCursor(data.meta?.startAfterId ?? undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [currentCursor, debouncedQuery]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  const goNext = () => {
    setCursorHistory((prev) => [...prev, currentCursor]);
    setCurrentCursor(nextCursor);
    setPageIndex((p) => p + 1);
  };

  const goPrev = () => {
    setCursorHistory((prev) => {
      const newHistory = [...prev];
      const prevCursor = newHistory.pop();
      setCurrentCursor(prevCursor);
      return newHistory;
    });
    setPageIndex((p) => Math.max(0, p - 1));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Contacts</h1>
            {!loading && !error && (
              <p className="text-sm text-gray-500">{total.toLocaleString()} total</p>
            )}
          </div>
          <input
            type="search"
            placeholder="Search contacts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            <strong>Error:</strong> {error}
            {error.includes("GHL_API_KEY") && (
              <p className="mt-1 text-red-600">
                Copy <code>.env.example</code> to <code>.env.local</code> and add
                your GoHighLevel API key and Location ID.
              </p>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4 animate-pulse"
              >
                <div className="w-10 h-10 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/3" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Contact list */}
        {!loading && !error && (
          <>
            {contacts.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                {debouncedQuery ? "No contacts match your search." : "No contacts found."}
              </div>
            ) : (
              <div className="space-y-3">
                {contacts.map((c) => (
                  <ContactCard key={c.id} contact={c} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <button
                  onClick={goPrev}
                  disabled={pageIndex === 0}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-600">
                  Page {pageIndex + 1} of {totalPages}
                </span>
                <button
                  onClick={goNext}
                  disabled={!nextCursor || pageIndex >= totalPages - 1}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
