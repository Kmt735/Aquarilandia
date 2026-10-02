import AboutSection from '../components/organisms/AboutSection'
import CategoryGrid from '../components/organisms/CategoryGrid'
import FeaturedFish from '../components/organisms/FeaturedFish'
import Footer from '../components/organisms/Footer'
import Hero from '../components/organisms/Hero'
import MfaBand from '../components/organisms/MfaBand'
import OfferStrip from '../components/organisms/OfferStrip'
import ServicesPreview from '../components/organisms/ServicesPreview'

export default function HomePage() {
  return (
    <>
      <Hero />
      <AboutSection />
      <CategoryGrid />
      <FeaturedFish />
      <OfferStrip />
      <MfaBand />
      <ServicesPreview />
      <Footer />
    </>
  )
}
