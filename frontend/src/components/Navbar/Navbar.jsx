import React, { useState } from 'react'
import { IoMdSearch } from 'react-icons/io'
import { FaCartShopping } from 'react-icons/fa6'
import DarkMode from './DarkMode'
import { FaCaretDown, FaBars } from 'react-icons/fa6'
import { IoClose } from 'react-icons/io5'
import SideCart from '../ui/SideCart'
import { useNavigate } from 'react-router-dom'

const MenuLinks = [
  {
    id: 1,
    name: "Home",
    link: "/#",
  },
  {
    id: 2,
    name: "Shop",
    link: "/#shop",
  },
  {
    id: 3,
    name: "About",
    link: "/#about",
  },
  {
    id: 4,
    name: "Contact",
    link: "/#contact",
  },
]

const DropdownLinks = [
  {
    id: 1,
    name: "Gear",
    link: "/#gear",
  },
  {
    id: 2,
    name: "Laptop",
    link: "/#laptop",
  },
  {
    id: 3,
    name: "PC",
    link: "/#pc",
  },
]

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isCartOpen, setIsCartOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const navigate = useNavigate()

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen)
  }

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen)
  }

  const toggleCart = () => {
    setIsCartOpen(!isCartOpen)
  }

  const handleSearch = (e) => {
    e?.preventDefault()
    const trimmed = searchQuery.trim()
    const target = trimmed ? `/products?q=${encodeURIComponent(trimmed)}` : '/products'
    navigate(target)
    setIsMenuOpen(false)
  }

  return (
    <div className="bg-white dark:bg-gray-900 dark:text-white duration-200 relative z-40">
      <div className="py-4">
        <div className='container flex justify-between items-center'>
            {/* Logo and links Section */}
            <div className="flex items-center gap-4">
                <a href="#"
                className="text-primary tracking-widest text-2xl sm:text-3xl uppercase lg:text-4xl font-bitcount font-semi"
                >
                    GearUp
                </a>
                
                {/* Desktop Menu Items */}
                <div className="hidden lg:block">
                    <ul className="flex items-center gap-4">
                      {
                        MenuLinks.map((data, index) => (
                          <li key={index}>
                            <a href={data.link}
                            className="inline-block px-4 font-semibold font-bitcount text-gray-500 hover:text-black dark:hover:text-white duration-200"
                            > {data.name} </a>
                          </li>
                        ))
                      }

                      {/* Desktop Dropdown */}
                      <li className="relative cursor-pointer group">
                        <a href="#" className="inline-block px-4 font-semibold font-bitcount text-gray-500 hover:text-black dark:hover:text-white duration-200 flex items-center gap-1">
                          Categories
                          <span className="group-hover:rotate-180 duration-200">
                            <FaCaretDown className="text-sm"/>
                          </span>
                        </a>
                        {/* Dropdown links */}
                        <div className="absolute z-[9999] hidden group-hover:block w-[200px] rounded-md bg-white shadow-md dark:bg-gray-900 p-2 dark:text-white">
                          <ul className="space-y-2">
                            {
                              DropdownLinks.map((data, index) => (
                                <li key={data.id}>
                                  <a href={data.link} className="font-semibold font-bitcount text-gray-500 hover:text-black dark:hover:text-white duration-200 inline-block w-full p-2 hover:bg-primary/20 rounded-md">
                                    {data.name}
                                  </a>
                                </li> 
                              ))
                            }
                          </ul>
                        </div>
                      </li>
                    </ul>
                </div>
            </div>

            {/* Navbar Right Section */}
            <div className="flex justify-between items-center gap-2 sm:gap-4">
              {/* Search Bar Section */}
              <form onSubmit={handleSearch} className="relative group hidden sm:block">
                <input 
                  type="text" 
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="search-bar pr-11"
                />
                <button type="submit" className="absolute top-1/2 -translate-y-1/2 right-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                  <IoMdSearch className="text-xl text-gray-600 group-hover:text-primary dark:text-gray-400 duration-200" />
                </button>
              </form>
              {/* Order-button Section */}
              <button 
                onClick={toggleCart}
                className="relative p-2 sm:p-3 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors duration-200"
              >
                <FaCartShopping className="text-lg sm:text-xl text-gray-600 group-hover:text-primary dark:text-gray-400 " />
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-red-500 text-white rounded-full absolute top-0 right-0 flex items-center justify-center text-xs">4</div>
              </button>
              {/* Dark Mode Toggle Section */}
              <div className="hidden sm:block">
                <DarkMode />
              </div>
              
              {/* Mobile Menu Button */}
              <button 
                onClick={toggleMenu}
                className="lg:hidden p-2 text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-white duration-200"
              >
                {isMenuOpen ? <IoClose className="text-xl" /> : <FaBars className="text-xl" />}
              </button>
            </div>
        </div>

        {/* Mobile Menu */}
        <div className={`lg:hidden transition-all duration-300 ease-in-out ${
          isMenuOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 overflow-hidden'
        }`}>
          <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div className="container py-4">
              {/* Mobile Menu Links */}
              <ul className="space-y-4 text-center">
                {MenuLinks.map((data, index) => (
                  <li key={index}>
                    <a 
                      href={data.link}
                      className="block px-4 py-2 font-semibold font-bitcount text-gray-500 hover:text-black dark:hover:text-white duration-200 hover:bg-primary/10 rounded-md"
                      onClick={() => setIsMenuOpen(false)}
                    >
                      {data.name}
                    </a>
                  </li>
                ))}
                
                {/* Mobile Dropdown */}
                <li className="text-center">
                  <button 
                    onClick={toggleDropdown}
                    className="inline-flex items-center gap-2 px-4 py-2 font-semibold font-bitcount text-gray-500 hover:text-black dark:hover:text-white duration-200 hover:bg-primary/10 rounded-md"
                  >
                    Categories
                    <FaCaretDown className={`text-sm transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {/* Mobile Dropdown Links */}
                  <div className={`transition-all duration-300 ease-in-out ${
                    isDropdownOpen ? 'max-h-40 opacity-100 mt-2' : 'max-h-0 opacity-0 overflow-hidden'
                  }`}>
                    <ul className="space-y-2 bg-gray-50 dark:bg-gray-800 rounded-md p-2">
                      {DropdownLinks.map((data, index) => (
                        <li key={data.id}>
                          <a 
                            href={data.link} 
                            className="block px-4 py-2 font-semibold font-bitcount text-gray-500 hover:text-black dark:hover:text-white duration-200 hover:bg-primary/20 rounded-md"
                            onClick={() => {
                              setIsMenuOpen(false)
                              setIsDropdownOpen(false)
                            }}
                          >
                            {data.name}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              </ul>
              
              {/* Mobile Search and Dark Mode */}
              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex flex-col sm:flex-row gap-4 items-center justify-center">
                  {/* Mobile Search */}
                  <form onSubmit={handleSearch} className="relative w-full max-w-xs">
                    <input 
                      type="text" 
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-bar w-full pr-11"
                    />
                    <button type="submit" className="absolute top-1/2 -translate-y-1/2 right-3">
                      <IoMdSearch className="text-xl text-gray-600 dark:text-gray-400" />
                    </button>
                  </form>
                  {/* Mobile Dark Mode */}
                  <div className="sm:hidden">
                    <DarkMode />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Side Cart */}
      <SideCart isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  )
}

export default Navbar