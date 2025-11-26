import React from 'react'
import TiltEffect from '../ui/TiltEffect'
import { useNavigate } from 'react-router-dom'

const Categoty = () => {
  const navigate = useNavigate()

  const handleCategoryClick = (categoryId) => {
    if (!categoryId) return
    navigate(`/products?categoryId=${categoryId}`)
  }

  return (
    <div className='py-4 sm:py-8'>
        <div>
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8'>
                {/* first collumn - Headset/Tai nghe */}
                <TiltEffect 
                    rotateAmplitude={5} 
                    scaleOnHover={1}
                    className="cursor-pointer"
                    overlayContent={
                        <div className="absolute bottom-0 -right-0 flex items-end">
                            <img src="/images/category/category-6.png" alt="" className='w-[120px] sm:w-[150px] lg:w-[190px]'></img>
                        </div>
                    }
                    displayOverlayContent={true}
                >
                    <div 
                        className='py-6 sm:py-8 lg:py-10 pl-4 sm:pl-5 bg-gradient-to-br from-[#000046] to-[#1CB5E0] text-white rounded-2xl sm:rounded-3xl relative h-[280px] sm:h-[300px] lg:h-[320px] flex items-end shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] cursor-pointer hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-shadow duration-300'
                        onClick={() => handleCategoryClick(16)}
                    >
                        <div>
                            <div className='mb-3 sm:mb-4'>
                                <p className='mb-[2px] text-gray-400 text-sm sm:text-base'>Enjoy</p>
                                <p className='text-lg sm:text-xl lg:text-2xl font-semibold mb-[2px]'>With</p>
                                <p className='text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-normal opacity-20 mb-2 font-bitcount'>Headset</p>
                            </div>
                        </div>
                    </div>
                </TiltEffect>
                {/* second collumn */}
                <TiltEffect 
                    rotateAmplitude={5} 
                    scaleOnHover={1}
                    className="cursor-pointer"
                    overlayContent={
                        <div className="absolute -right-0 bottom-2 sm:bottom-5">
                            <img src="/images/category/category-1.png" alt="" className='w-[120px] sm:w-[150px] lg:w-[190px]'></img>
                        </div>
                    }
                    displayOverlayContent={true}
                >
                    <div 
                        className='py-6 sm:py-8 lg:py-10 pl-4 sm:pl-5 bg-gradient-to-br from-[#EB5757] to-[#000000] text-white rounded-2xl sm:rounded-3xl relative h-[280px] sm:h-[300px] lg:h-[320px] flex items-end shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] cursor-pointer hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-shadow duration-300'
                        onClick={() => handleCategoryClick(13)}
                    >
                        <div>
                            <div className='mb-3 sm:mb-4'>
                                <p className='mb-[2px] text-white/60 text-sm sm:text-base'>Enjoy</p>
                                <p className='text-lg sm:text-xl lg:text-2xl font-semibold mb-[2px]'>With</p>
                                <p className='text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-normal opacity-20 mb-2 font-bitcount'>Monitor</p>
                            </div>
                        </div>
                    </div>
                </TiltEffect>
                {/* third collumn */}
                <TiltEffect 
                    rotateAmplitude={5} 
                    scaleOnHover={1} 
                    className="col-span-1 sm:col-span-2 lg:col-span-2 cursor-pointer"
                    overlayContent={
                        <div className="absolute right-2 sm:right-6 lg:right-10 bottom-0">
                            <img src="/images/category/category-5.png" alt="" className='w-[160px] sm:w-[200px] lg:w-[240px]'></img>
                        </div>
                    }
                    displayOverlayContent={true}
                >
                    <div 
                        className='py-6 sm:py-8 lg:py-10 pl-4 sm:pl-5 bg-gradient-to-br from-[#20002c] to-[#cbb4d4] text-white rounded-2xl sm:rounded-3xl relative h-[280px] sm:h-[300px] lg:h-[320px] flex items-end shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] cursor-pointer hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-shadow duration-300'
                        onClick={() => handleCategoryClick(1)}
                    >
                        <div>
                            <div className='mb-3 sm:mb-4'>
                                <p className='mb-[2px] text-white/60 text-sm sm:text-base'>Enjoy</p>
                                <p className='text-lg sm:text-xl lg:text-2xl font-semibold mb-[2px]'>With</p>
                                <p className='text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-normal opacity-20 mb-2 font-bitcount'>Laptop</p>
                            </div>
                        </div>
                    </div>
                </TiltEffect>
            </div>
            
            {/* Second Row*/}
            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8 mt-4 sm:mt-6 lg:mt-8'>
                {/* First column*/}
                <TiltEffect 
                    rotateAmplitude={5} 
                    scaleOnHover={1} 
                    className="col-span-1 sm:col-span-2 lg:col-span-2 cursor-pointer"
                    overlayContent={
                        <div className="absolute right-2 sm:right-6 lg:right-10 bottom-7">
                            <img src="/images/category/category-3.png" alt="" className='w-[160px] sm:w-[200px] lg:w-[240px]'></img>
                        </div>
                    }
                    displayOverlayContent={true}
                >
                    <div 
                        className='py-6 sm:py-8 lg:py-10 pl-4 sm:pl-5 text-white rounded-2xl sm:rounded-3xl relative h-[280px] sm:h-[300px] lg:h-[320px] flex items-end shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] cursor-pointer hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-shadow duration-300'
                        onClick={() => handleCategoryClick(14)}
                        style={{background: 'linear-gradient(to left, #EAEAEA, #DBDBDB,rgb(202, 199, 199), #ADA996)'}}
                    >
                        <div>
                            <div className='mb-3 sm:mb-4'>
                                <p className='mb-[2px] text-white/60 text-sm sm:text-base'>Peak</p>
                                <p className='text-lg sm:text-xl lg:text-2xl font-semibold mb-[2px]'>Setup</p>
                                <p className='text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-normal mb-2 text-white font-bitcount'>Keyboard</p>
                            </div>
                        </div>
                    </div>
                </TiltEffect>
                
                {/* Second column */}
                <TiltEffect 
                    rotateAmplitude={5} 
                    scaleOnHover={1}
                    className="cursor-pointer"
                    overlayContent={
                        <div className="absolute -right-0 bottom-4 sm:bottom-5">
                            <img src="/images/category/category-2.png" alt="" className='w-[120px] sm:w-[150px] lg:w-[190px]'></img>
                        </div>
                    }
                    displayOverlayContent={true}
                >
                    <div 
                        className='py-6 sm:py-8 lg:py-10 pl-4 sm:pl-5 bg-gradient-to-br from-[#c31432] to-[#240b36] text-white rounded-2xl sm:rounded-3xl relative h-[280px] sm:h-[300px] lg:h-[320px] flex items-end shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] cursor-pointer hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-shadow duration-300'
                        onClick={() => handleCategoryClick(6)}
                    >
                        <div>
                            <div className='mb-3 sm:mb-4'>
                                <p className='mb-[2px] text-white/60 text-sm sm:text-base'>Full</p>
                                <p className='text-lg sm:text-xl lg:text-2xl font-semibold mb-[2px]'>Powerful</p>
                                <p className='text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-normal opacity-20 mb-2 font-bitcount'>GPU</p>
                            </div>
                        </div>
                    </div>
                </TiltEffect>
                
                {/* Third column */}
                <TiltEffect 
                    rotateAmplitude={5} 
                    scaleOnHover={1}
                    className="cursor-pointer"
                    overlayContent={
                        <div className="absolute bottom-4 -right-0">
                            <img src="/images/category/category-4.png" alt="" className='w-[120px] sm:w-[150px] lg:w-[190px]'></img>
                        </div>
                    }
                    displayOverlayContent={true}
                >
                    <div 
                        className='py-6 sm:py-8 lg:py-10 pl-4 sm:pl-5 bg-gradient-to-br from-black/90 to-black/30 text-white rounded-2xl sm:rounded-3xl relative h-[280px] sm:h-[300px] lg:h-[320px] flex items-end shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.3)] cursor-pointer hover:shadow-[0_12px_40px_rgba(0,0,0,0.3)] dark:hover:shadow-[0_12px_40px_rgba(0,0,0,0.4)] transition-shadow duration-300'
                        onClick={() => handleCategoryClick(15)}
                    >
                        <div>
                            <div className='mb-3 sm:mb-4'>
                                <p className='mb-[2px] text-white/60 text-sm sm:text-base'>Enjoy</p>
                                <p className='text-lg sm:text-xl lg:text-2xl font-semibold mb-[2px]'>With</p>
                                <p className='text-2xl sm:text-3xl lg:text-4xl xl:text-5xl font-normal opacity-20 mb-2 font-bitcount'>Mouse</p>
                            </div>
                        </div>
                    </div>
                </TiltEffect>
            </div>
        </div>
    </div>
  )
}

export default Categoty