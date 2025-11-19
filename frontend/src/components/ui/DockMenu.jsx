import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import Dock from './Dock'
import MegaMenu from './MegaMenu'
import { FaHome, FaShoppingCart, FaBox, FaUser, FaSearch, FaSun, FaMoon } from 'react-icons/fa'
import { useTheme } from '../../ui/ThemeProvider'

export default function DockMenu() {
  const navigate = useNavigate()
  const { token, user, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const [showMegaMenu, setShowMegaMenu] = useState(false)
  const [megaMenuItems, setMegaMenuItems] = useState([])

  const handleProductsClick = () => {
    setMegaMenuItems([]) // Clear items to show full categories menu
    setShowMegaMenu(true)
  }

  const handleAccountClick = () => {
    if (!token) {
      navigate('/login')
    } else {
      setMegaMenuItems([
        { label: 'Cart', href: '/cart', icon: <FaShoppingCart /> },
        { label: 'Orders', href: '/orders', icon: <FaBox /> },
        { label: 'Profile', href: '/profile', icon: <FaUser /> },
        { label: 'Logout', icon: '🚪', onClick: () => {
          logout();
          navigate('/');
          setShowMegaMenu(false);
        }},
      ])
      setShowMegaMenu(true)
    }
  }

  const dockItems = [
    {
      icon: <FaHome />,
      label: 'Home',
      onClick: () => navigate('/')
    },
    {
      icon: <FaSearch />,
      label: 'Products',
      onClick: handleProductsClick
    },
    {
      icon: <FaUser />,
      label: token ? user?.fullName || 'Account' : 'Login',
      onClick: handleAccountClick
    },
    {
      icon: theme === 'light' ? <FaMoon /> : <FaSun />,
      label: theme === 'light' ? 'Dark Mode' : 'Light Mode',
      onClick: toggle
    },
  ]

  return (
    <>
      <Dock 
        items={dockItems}
        panelHeight={68}
        baseItemSize={50}
        magnification={70}
        distance={200}
      />
      <MegaMenu 
        isOpen={showMegaMenu}
        onClose={() => setShowMegaMenu(false)}
        position="bottom-center"
        items={megaMenuItems}
      />
    </>
  )
}

