import CategoryBand from '../components/organisms/CategoryBand'
import FeaturedProducts from '../components/organisms/FeaturedProducts'
import GuideCta from '../components/organisms/GuideCta'
import Hero from '../components/organisms/Hero'

export default function HomePage() {
  return (
    <>
      <Hero />
      <CategoryBand />
      <FeaturedProducts />
      <GuideCta />
    </>
  )
}
