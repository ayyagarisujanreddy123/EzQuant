import { Landing } from '@/components/landing/Landing'

// Simple-identity mode — the landing is public. Identity (full name + DOB) is
// collected on /enter and persisted in localStorage; AppShell redirects
// anonymous visitors to /enter when they try to access app pages.
export default function Home() {
  return <Landing />
}
