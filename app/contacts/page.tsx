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
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex items-start gap-4 hover:shadow-md hover:border-gray-200 transition-all">
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 truncate">{name}</p>
        {contact.companyName && (
          <p className="text-sm text-gray-500 truncate">{contact.companyName}</p>
        )}
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="hover:text-indigo-600 truncate">
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
                className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
      {contact.dateAdded && (
        <p className="flex-shrink-0 text-xs text-gray-400 whitespace-nowrap">
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
      const params = new URLSearchParams({ limit: String(PAGE_SIZE) });
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
      const next = [...prev];
      const cursor = next.pop();
      setCurrentCursor(cursor);
      return next;
    });
    setPageIndex((p) => Math.max(0, p - 1));
  };

  return (
    <div className="p-8">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Contacts</h1>
          {!loading && !error && (
            <p className="text-sm text-gray-500 mt-1">
              {total.toLocaleString()} total leads
            </p>
          )}
        </div>
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            placeholder="Search contacts..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-64 bg-white"
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-4 animate-pulse"
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-16" />
            </div>
          ))}
        </div>
      )}

      {/* Contact list */}
      {!loading && !error && (
        <>
          {contacts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
              <svg className="w-12 h-12 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm">
                {debouncedQuery ? "No contacts match your search." : "No contacts found."}
              </p>
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
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>
              <span className="text-sm text-gray-500">
                Page <span className="font-semibold text-gray-800">{pageIndex + 1}</span> of{" "}
                <span className="font-semibold text-gray-800">{totalPages}</span>
              </span>
              <button
                onClick={goNext}
                disabled={!nextCursor || pageIndex >= totalPages - 1}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
