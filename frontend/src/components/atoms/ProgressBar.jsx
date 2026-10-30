import { Progress } from '@/components/ui/progress'

export default function ProgressBar({ valor, rotulo = 'Progresso' }) {
  return <Progress value={valor * 100} className="h-1.5 bg-surface-muted" aria-label={rotulo} />
}
