import Slider from 'react-slick'
import Button from '../ui/Button'

const Hero = () => {

  const HeroData = [
    {
     id: 1,
     image: '/images/hero/hero-1.webp',
     subtitle: 'Beats Solo',
     title1: '30% OFF',
     title2: 'Headphones',
    
    },
    {
      id: 2,
      image: '/images/hero/hero-2.png',
      subtitle: 'Beats Solo',
      title1: '40% OFF',
      title2: 'Earbuds',
      
    },
    {
      id: 3,
      image: '/images/hero/hero-3.png',
      subtitle: 'For Gaming',
      title1: '10% OFF',
      title2: 'Monitor',
      
    },
  ]

  const settings = {
    dots: false,
    arrows: false,
    infinite: true,
    speed: 800,
    slidesToScroll: 1,
    autoplay: true,
    autoplaySpeed: 5000,
    cssEase: "ease-in-out",
    pauseOnHover: false,
    pauseOnFocus: true,
  }
  return (
    <div className="mx-auto max-w-7xl px-4 mt-28 sm:mt-32">
      <div className="overflow-hidden rounded-2xl sm:rounded-3xl min-h-[500px] sm:min-h-[550px] lg:min-h-[650px] hero-bg-color flex justify-center items-center shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="w-full pb-4 sm:pb-8 lg:pb-0">
          {/* Hero Section */}
          <Slider {...settings}>
            {HeroData.map((data) => (
              <div key={data.id}>
                {/* Mobile Layout - Stacked */}
                <div className="flex flex-col items-center text-center sm:hidden">
                  {/* Text content - top */}
                  <div className="flex flex-col items-center gap-2 mb-4 relative z-10">
                    <h1 className="text-xl font-bold">{data.subtitle}</h1>
                    <h1 className="text-3xl font-bold">{data.title1}</h1>
                  </div>
                  
                  {/* Image - center - larger on mobile */}
                  <div className="relative mb-4">
                    <img src={data.image} alt="" className="w-[280px] h-[280px] object-contain mx-auto drop-shadow-[-8px_4px_6px_rgba(0,0,0,.4)] relative z-40"/>
                    {/* Title2 behind image - ensure it shows for all items */}
                    <h1 className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-3xl sm:text-4xl uppercase text-gray-400 font-bold font-bitcount z-10 whitespace-nowrap">{data.title2}</h1>
                  </div>
                  
                  {/* Button - bottom */}
                  <div className="relative z-10">
                    <Button text="Mua Ngay" bgColor="bg-primary" textColor="text-white" handler={() => {}} />
                  </div>
                </div>

                {/* Desktop Layout - Side by side */}
                <div className="hidden sm:grid grid-cols-2">
                  {/* text context section */}
                  <div className="flex flex-col justify-center gap-4 pl-3 text-left relative z-10">
                    <h1 className="text-2xl sm:text-4xl lg:text-6xl font-bold">{data.subtitle}</h1>
                    <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold">{data.title1}</h1>
                    <h1 className="text-4xl sm:text-6xl lg:text-7xl xl:text-8xl uppercase text-gray-400 sm:text-[60px] md:text-[80px] lg:text-[100px] xl:text-[150px] font-bold font-bitcount">{data.title2}</h1>
                    <div>
                      <Button text="Mua Ngay" bgColor="bg-primary" textColor="text-white" handler={() => {}} />
                    </div>
                  </div>
                  {/* image section */}
                  <div>
                    <div>
                      <img src={data.image} alt="" className="w-[300px] sm:w-[400px] lg:w-[500px] h-[300px] sm:h-[400px] lg:h-[500px] scale-110 lg:scale-125 object-contain mx-auto drop-shadow-[-8px_4px_6px_rgba(0,0,0,.4)] relative z-40"/>
                    </div>
                  </div>
                </div>
                
              </div>
            ))}
          </Slider>
        </div>
      </div>
    </div>
  )
}

export default Hero