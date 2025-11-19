import React from 'react'

export function Card({ children, className = '', ...props }) {
  return (
    <div className={`card ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardBody({ children, className = '', ...props }) {
  return (
    <div className={`p-4 ${className}`} {...props}>
      {children}
    </div>
  )
}


