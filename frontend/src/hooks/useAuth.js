import { useContext } from 'react'
import { AuthContext } from '../context/contexts'

export default function useAuth() {
  return useContext(AuthContext)
}
