import { useContext } from 'react'
import { CheckoutContext } from '../context/contexts'

export default function useCheckout() {
  return useContext(CheckoutContext)
}
