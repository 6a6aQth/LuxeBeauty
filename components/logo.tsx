export default function Logo({ className }: { className?: string } = {}) {
  return (
    <div className={`flex flex-col items-center py-2 ${className || ""}`}>
      <div className="text-center">
        <div className="text-2xl font-serif tracking-wider">LAURYN</div>
        <div className="text-3xl font-serif italic tracking-wide -mt-0.5">luxe</div>
        <div className="text-[10px] tracking-[0.2em] mt-1">B E A U T Y &nbsp; S T U D I O</div>
        <div className="text-[8px] tracking-[0.1em] mt-0.5">E S T D 2 0 2 2</div>
      </div>
    </div>
  )
}
