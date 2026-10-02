import { useContext } from 'react'
import { CartContext } from '../context/contexts'

export default function useCart() {
  return useContext(CartContext)
}
