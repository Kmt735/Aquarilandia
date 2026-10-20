import Eyebrow from '../atoms/Eyebrow'

export default function PageHead({ eyebrow, titulo }) {
  return (
    <div className="border-b border-border bg-surface-tint">
      <div className="mx-auto max-w-[1200px] px-4 pt-14 pb-12 sm:px-6 desk:px-10 desk:pt-20 desk:pb-14">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="mt-4 text-[38px] leading-[1.05] text-primary-dark desk:text-[52px] dark:text-foreground">{titulo}</h1>
      </div>
    </div>
  )
}
