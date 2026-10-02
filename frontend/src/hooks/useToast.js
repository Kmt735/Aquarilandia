import { useContext } from 'react'
import { ToastContext } from '../context/contexts'

export default function useToast() {
  return useContext(ToastContext)
}
