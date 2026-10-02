export default function Overlay({ onClick }) {
  return <div aria-hidden="true" onClick={onClick} className="fixed inset-0 z-[300] bg-[rgba(1,8,10,.72)]" />
}
