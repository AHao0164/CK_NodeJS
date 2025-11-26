import React, { useState, useEffect } from 'react'
import { MdDarkMode, MdLightMode } from 'react-icons/md'

const DarkMode = () => {
  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    // Kiểm tra theme đã lưu trong localStorage
    const savedTheme = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    
    // Xóa tất cả class theme cũ trước khi thêm class mới
    document.documentElement.classList.remove('dark', 'light')
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      setIsDark(true)
      document.documentElement.classList.add('dark')
    } else {
      setIsDark(false)
      document.documentElement.classList.add('light')
    }
  }, [])

  const toggleDarkMode = () => {
    if (isDark) {
      // Chuyển từ dark sang light
      setIsDark(false)
      document.documentElement.classList.remove('dark')
      document.documentElement.classList.add('light') 
      localStorage.setItem('theme', 'light')
    } else {
      // Chuyển từ light sang dark
      setIsDark(true)
      document.documentElement.classList.remove('light')
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    }
  }

  return (
    <button
      onClick={toggleDarkMode}
      className="relative p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
      aria-label="Toggle dark mode"
    >
      <div className="relative w-6 h-6">
        <MdLightMode 
          className={`absolute inset-0 w-6 h-6 text-yellow-500 transition-all duration-300 ${
            isDark ? 'opacity-0 rotate-180' : 'opacity-100 rotate-0'
          }`} 
        />
        <MdDarkMode 
          className={`absolute inset-0 w-6 h-6 text-blue-600 transition-all duration-300 ${
            isDark ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-180'
          }`} 
        />
      </div>
    </button>
  )
}

export default DarkMode