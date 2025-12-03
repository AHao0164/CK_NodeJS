export default function Button({ children, variant = 'primary', className = '', ...props }) {
  const variantClass = variant === 'outline' ? 'btn-outline' : variant === 'ghost' ? 'btn-ghost' : 'btn-primary'
  return (
    <button className={`btn ${variantClass} rounded-xl ${className}`} {...props}>
      {children}
    </button>
  )
}