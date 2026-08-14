/**
 * Shared frame for the legal documents.
 *
 * Narrower than the rest of the site on purpose. The browse grid wants width;
 * a document wants a measure short enough that the eye finds the start of the
 * next line without hunting for it.
 */
export default function LegalLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      {children}
    </div>
  );
}
