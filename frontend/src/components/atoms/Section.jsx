export default function Section({ children, className = '' }) {
  return <section className={`mx-auto max-w-[1180px] px-4 py-16 desk:px-10 ${className}`}>{children}</section>
}
