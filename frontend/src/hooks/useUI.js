import { useContext } from 'react'
import { UIContext } from '../context/contexts'

export default function useUI() {
  return useContext(UIContext)
}
