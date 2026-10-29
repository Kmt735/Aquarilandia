import CategoryBand from '../components/organisms/CategoryBand'
import FeaturedFish from '../components/organisms/FeaturedFish'
import FeaturedProducts from '../components/organisms/FeaturedProducts'
import GuideCta from '../components/organisms/GuideCta'
import Hero from '../components/organisms/Hero'
import OfferStrip from '../components/organisms/OfferStrip'
import ServicesPreview from '../components/organisms/ServicesPreview'

export default function HomePage() {
  return (
    <>
      <Hero />
      <CategoryBand />
      <FeaturedFish />
      <ServicesPreview />
      <OfferStrip />
      <FeaturedProducts />
      <GuideCta />
    </>
  )
}