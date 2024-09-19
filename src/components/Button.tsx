export function Button({children, onClick, disabled}: {children: any, onClick?: () => void, disabled?: boolean}) {
    return (
        <button onClick={onClick} disabled={disabled} type="button" className="bg-neutral-100 text-neutral-800 px-4 py-2 rounded-md disabled:bg-neutral-400">{children}</button>
    )
}