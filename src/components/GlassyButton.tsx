interface GlassyButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export function GlassyButton({ children, onClick, className = "" }: GlassyButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        relative
        px-8 py-4
        bg-white/20
        backdrop-blur-md
        border border-white/30
        rounded-2xl
        shadow-lg shadow-black/10
        transition-all duration-300
        hover:bg-white/30
        hover:border-white/50
        hover:shadow-xl hover:shadow-black/20
        hover:scale-105
        active:scale-95
        active:bg-white/40
        group
        overflow-hidden
        ${className}
      `}
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/5 to-transparent rounded-2xl" />
      
      {/* Shine effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      
      {/* Content */}
      <span className="relative z-10 text-white drop-shadow-sm">
        {children}
      </span>
    </button>
  );
}