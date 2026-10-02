import Eyebrow from '../atoms/Eyebrow'

export default function PageHead({ eyebrow, titulo }) {
  return (
    <div className="border-b border-line bg-page-head px-4 pt-11 pb-8 text-white desk:px-10">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-2 text-[32px]">{titulo}</h1>
    </div>
  )
}
