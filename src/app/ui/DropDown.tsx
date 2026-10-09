import {type CSSProperties, type JSX, type KeyboardEvent, useCallback, useEffect, useId, useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import type {Theme} from "./Themes.ts";
import {interpolateColor} from "./utils.ts";
import {DropDownClosedIcon, DropDownOpenIcon} from "./Icons.tsx";

/**
 * An option in a {@link DropDown}
 * @template V The type of the option's value
 */
export type DropDownOption<V extends string> = {
    /**
     * The value handed to the drop-down's `onChange` when this option is selected
     */
    value: V
    /**
     * The text shown for this option
     */
    label: string
}

type Props<V extends string> = {
    theme: Theme
    /**
     * The name of the drop-down's (hidden) form value
     */
    name: string
    /**
     * The options, in the order they're listed
     */
    options: Array<DropDownOption<V>>
    /**
     * The value of the selected option
     */
    value: V
    /**
     * Called with the value of the option the user selects
     * @param value The selected option's value
     */
    onChange: (value: V) => void
    /**
     * When `true`, the drop-down is shown in the theme's disabled colors and can't be changed.
     * Defaults to `false`.
     */
    disabled?: boolean
    /**
     * An accessible name for the drop-down, when there's no visible label for it
     */
    ariaLabel?: string
    /**
     * How long (in milliseconds) the open list stays open after the mouse leaves the drop-down
     * (the button and the list) before it closes. Moving back into either one in the meantime
     * keeps it open. The delay also lets the mouse cross the gap between the button and the list.
     * Defaults to 500 ms (the same as the expandable control bar's auto-collapse delay).
     */
    autoCloseDelay?: number
}

// the largest the list gets before it scrolls
const MAX_LIST_HEIGHT = 240
// how long the type-ahead keeps accumulating typed characters
const TYPE_AHEAD_TIMEOUT_MS = 500
// the gap between the trigger and the list
const LIST_OFFSET = 2

/**
 * Where the open list is placed, in viewport (fixed) coordinates
 */
type ListPlacement = {
    left: number
    minWidth: number
    top?: number
    bottom?: number
    maxHeight: number
}

/**
 * A themed drop-down: a button showing the selected option that opens a list of the options.
 * Unlike a native `<select>`, both the button and the open list follow the theme.
 *
 * The list is rendered into `document.body` (in fixed position, next to the button), so that a
 * container that clips its overflow (e.g. a collapsible control bar) can't cut it off. It opens
 * below the button, or above when there isn't enough room below, and closes when the page scrolls
 * or resizes (rather than drifting away from the button).
 *
 * It follows the WAI-ARIA "select-only combobox" pattern: focus stays on the button, which
 * points at the highlighted option through `aria-activedescendant`. Keyboard: ArrowDown/ArrowUp,
 * Enter, or Space open the list; while it's open, ArrowDown/ArrowUp/Home/End move the highlight,
 * Enter or Space select it, Tab selects it and moves on, and Escape closes the list unchanged;
 * typing jumps to the first option whose label starts with what was typed. The list also closes
 * (unchanged) shortly after the mouse leaves the drop-down (the button and the list), after the
 * `autoCloseDelay`.
 * @param props The properties
 * @return The drop-down
 * @template V The type of the options' values
 */
export function DropDown<V extends string>(props: Props<V>): JSX.Element {
    const {
        theme,
        name,
        options,
        value,
        onChange,
        disabled = false,
        ariaLabel,
        autoCloseDelay = 500,
    } = props

    const id = useId()
    const listId = `${id}-list`
    const optionId = (index: number): string => `${id}-option-${index}`

    const [open, setOpen] = useState<boolean>(false)
    // the highlighted option (keyboard focus or mouse hover) while the list is open
    const [activeIndex, setActiveIndex] = useState<number>(-1)
    const [placement, setPlacement] = useState<ListPlacement | undefined>(undefined)

    const buttonRef = useRef<HTMLButtonElement>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const typeAheadRef = useRef<{text: string, timeout: ReturnType<typeof setTimeout> | undefined}>({text: '', timeout: undefined})
    const mouseLeaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

    const selectedIndex = options.findIndex(option => option.value === value)
    const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

    const openList = useCallback(
        (highlight: number = selectedIndex): void => {
            if (disabled || options.length === 0) return
            setActiveIndex(highlight >= 0 ? highlight : 0)
            setOpen(true)
        },
        [disabled, options.length, selectedIndex]
    )

    const closeList = useCallback((): void => setOpen(false), [])

    const select = useCallback(
        (index: number): void => {
            const option = options[index]
            if (option !== undefined && option.value !== value) onChange(option.value)
            setOpen(false)
        },
        [options, value, onChange]
    )

    // a drop-down that becomes disabled while open closes (adjusting the state while rendering,
    // when the `disabled` prop changes, rather than in an effect)
    const [wasDisabled, setWasDisabled] = useState<boolean>(disabled)
    if (disabled !== wasDisabled) {
        setWasDisabled(disabled)
        if (disabled) setOpen(false)
    }

    // places the list next to the button: below it, or above it when there isn't enough room
    // below (and there's more room above)
    useLayoutEffect(
        () => {
            if (!open || buttonRef.current === null) return
            const rect = buttonRef.current.getBoundingClientRect()
            const spaceBelow = window.innerHeight - rect.bottom - LIST_OFFSET
            const spaceAbove = rect.top - LIST_OFFSET
            const below = spaceBelow >= Math.min(MAX_LIST_HEIGHT, spaceAbove) || spaceBelow >= spaceAbove
            setPlacement({
                left: rect.left,
                minWidth: rect.width,
                ...(below ?
                    {top: rect.bottom + LIST_OFFSET, maxHeight: Math.min(MAX_LIST_HEIGHT, spaceBelow)} :
                    {bottom: window.innerHeight - rect.top + LIST_OFFSET, maxHeight: Math.min(MAX_LIST_HEIGHT, spaceAbove)})
            })
        },
        [open]
    )

    // while open: close on a pointer press outside the drop-down, or when the page scrolls or
    // resizes (the list is fixed in place, so it would otherwise drift away from the button)
    useEffect(
        () => {
            if (!open) return
            const handlePointerDown = (event: PointerEvent) => {
                const target = event.target as Node
                if (buttonRef.current?.contains(target) || listRef.current?.contains(target)) return
                setOpen(false)
            }
            const handleScroll = (event: Event) => {
                // scrolling the list itself is fine
                if (listRef.current !== null && event.target instanceof Node && listRef.current.contains(event.target)) return
                setOpen(false)
            }
            const handleResize = () => setOpen(false)
            document.addEventListener('pointerdown', handlePointerDown, true)
            window.addEventListener('scroll', handleScroll, true)
            window.addEventListener('resize', handleResize)
            return () => {
                document.removeEventListener('pointerdown', handlePointerDown, true)
                window.removeEventListener('scroll', handleScroll, true)
                window.removeEventListener('resize', handleResize)
            }
        },
        [open]
    )

    // keeps the highlighted option scrolled into view
    useEffect(
        () => {
            if (!open || activeIndex < 0) return
            document.getElementById(optionId(activeIndex))?.scrollIntoView({block: 'nearest'})
        },
        // `optionId` only depends on `id`, which never changes
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [open, activeIndex, placement]
    )

    // clears any pending type-ahead timer on unmount
    useEffect(
        () => () => clearTimeout(typeAheadRef.current.timeout),
        []
    )

    // a pending mouse-leave close is dropped once the list closes (or the drop-down unmounts)
    useEffect(
        () => {
            if (!open) return
            return () => {
                clearTimeout(mouseLeaveTimeoutRef.current)
                mouseLeaveTimeoutRef.current = undefined
            }
        },
        [open]
    )

    // closes the open list `autoCloseDelay` after the mouse leaves the button or the list, unless
    // the mouse enters the other one (or comes back) in the meantime
    function handleMouseLeave(): void {
        if (!open) return
        clearTimeout(mouseLeaveTimeoutRef.current)
        mouseLeaveTimeoutRef.current = setTimeout(closeList, autoCloseDelay)
    }

    function handleMouseEnter(): void {
        clearTimeout(mouseLeaveTimeoutRef.current)
        mouseLeaveTimeoutRef.current = undefined
    }

    /**
     * Jumps to the first option (from the highlighted one onwards, wrapping around) whose label
     * starts with the characters typed so far
     * @param character The character just typed
     * @return The index of the matching option, or -1 when none matches
     */
    function typeAhead(character: string): number {
        const typeAheadState = typeAheadRef.current
        clearTimeout(typeAheadState.timeout)
        typeAheadState.text += character.toLowerCase()
        typeAheadState.timeout = setTimeout(() => typeAheadState.text = '', TYPE_AHEAD_TIMEOUT_MS)

        const start = open ? activeIndex : selectedIndex
        // a repeated single character cycles through the options starting with it
        const searchFrom = typeAheadState.text.length === 1 ? start + 1 : Math.max(start, 0)
        for (let offset = 0; offset < options.length; offset++) {
            const index = (searchFrom + offset) % options.length
            if (options[index].label.toLowerCase().startsWith(typeAheadState.text)) return index
        }
        return -1
    }

    function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>): void {
        if (disabled) return
        const last = options.length - 1

        if (!open) {
            switch (event.key) {
                case 'ArrowDown':
                case 'ArrowUp':
                case 'Enter':
                case ' ':
                    event.preventDefault()
                    openList()
                    return
                case 'Home':
                    event.preventDefault()
                    openList(0)
                    return
                case 'End':
                    event.preventDefault()
                    openList(last)
                    return
            }
        } else {
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault()
                    setActiveIndex(index => Math.min(last, index + 1))
                    return
                case 'ArrowUp':
                    event.preventDefault()
                    setActiveIndex(index => Math.max(0, index - 1))
                    return
                case 'Home':
                    event.preventDefault()
                    setActiveIndex(0)
                    return
                case 'End':
                    event.preventDefault()
                    setActiveIndex(last)
                    return
                case 'Enter':
                case ' ':
                    event.preventDefault()
                    select(activeIndex)
                    return
                case 'Tab':
                    // selects the highlighted option, and lets focus move on as usual
                    select(activeIndex)
                    return
                case 'Escape':
                    event.preventDefault()
                    closeList()
                    return
            }
        }

        // type-ahead (printable characters only, and not shortcuts)
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            const match = typeAhead(event.key)
            if (match < 0) return
            if (open) setActiveIndex(match)
            else openList(match)
        }
    }

    const borderColor = disabled ? theme.disabledColor : theme.color
    const textColor = disabled ? theme.disabledColor : theme.color
    const buttonStyle: CSSProperties = {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        backgroundColor: disabled ? theme.disabledBackgroundColor : theme.backgroundColor,
        color: textColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 3,
        padding: '4px 6px 4px 8px',
        font: 'inherit',
        fontSize: 13,
        lineHeight: '18px',
        whiteSpace: 'nowrap',
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none',
        boxShadow: open ? `0 0 0 2px ${interpolateColor(theme.backgroundColor, theme.color, 25)}` : 'none',
    }

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                role="combobox"
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-controls={listId}
                aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
                aria-label={ariaLabel}
                aria-disabled={disabled}
                disabled={disabled}
                data-name={name}
                style={buttonStyle}
                onClick={() => open ? closeList() : openList()}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onKeyDown={handleKeyDown}
            >
                <span>{selected?.label ?? ''}</span>
                {open ?
                    <DropDownOpenIcon color={textColor}/> :
                    <DropDownClosedIcon color={textColor}/>}
            </button>
            {/* the drop-down's value, for forms (as a native select's would be) */}
            <input type="hidden" name={name} value={value}/>
            {open && placement !== undefined && createPortal(
                <ul
                    ref={listRef}
                    onMouseEnter={handleMouseEnter}
                    onMouseLeave={handleMouseLeave}
                    id={listId}
                    role="listbox"
                    aria-label={ariaLabel}
                    style={{
                        position: 'fixed',
                        left: placement.left,
                        top: placement.top,
                        bottom: placement.bottom,
                        minWidth: placement.minWidth,
                        maxHeight: placement.maxHeight,
                        overflowY: 'auto',
                        boxSizing: 'border-box',
                        margin: 0,
                        padding: '3px 0',
                        listStyle: 'none',
                        backgroundColor: theme.backgroundColor,
                        color: theme.color,
                        // a softer border than the button's, so the list doesn't look boxed in
                        border: `1px solid ${interpolateColor(theme.color, theme.backgroundColor, 70)}`,
                        borderRadius: 3,
                        boxShadow: `0 4px 12px ${interpolateColor('transparent', theme.name === 'dark' ? '#000' : '#555', 40)}`,
                        font: 'inherit',
                        fontSize: 13,
                        lineHeight: '18px',
                        zIndex: 10000,
                    }}
                >
                    {options.map((option, index) => {
                        const isSelected = index === selectedIndex
                        const isActive = index === activeIndex
                        return (
                            <li
                                key={option.value}
                                id={optionId(index)}
                                role="option"
                                aria-selected={isSelected}
                                data-value={option.value}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    padding: '3px 10px 3px 6px',
                                    whiteSpace: 'nowrap',
                                    cursor: 'pointer',
                                    fontWeight: isSelected ? 600 : 'normal',
                                    backgroundColor: isActive ?
                                        interpolateColor(theme.backgroundColor, theme.color, 15) :
                                        'transparent',
                                }}
                                // keeps focus on the button (the list is never focused)
                                onMouseDown={event => event.preventDefault()}
                                onMouseEnter={() => setActiveIndex(index)}
                                onClick={() => select(index)}
                            >
                                {/* marks the selected option (keeps every label aligned) */}
                                <span aria-hidden="true" style={{width: 10, textAlign: 'center'}}>{isSelected ? '✓' : ''}</span>
                                <span>{option.label}</span>
                            </li>
                        )
                    })}
                </ul>,
                document.body
            )}
        </>
    )
}
