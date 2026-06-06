export default function PageWrapper({ children }) {
  return (
    <section className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6">
      {children}
    </section>
  );
}
