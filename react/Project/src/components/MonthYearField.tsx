// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: MM/YY masked TextInput for card expiry. Mirrors the
//              format printed on physical cards so users don't have to
//              think in YYYY-MM-DD when typing on a phone. Auto-inserts
//              the slash as the user types and pulls up the number pad.
//              Conversion helpers translate to/from the YYYY-MM-DD
//              shape that the backend expects: MM/YY round-trips as
//              "the last day of that month, year 20YY" — matches the
//              card-issuer convention that an expiry of 09/28 means the
//              card is valid through the end of September 2028.

import { useEffect, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

interface Props {
    /** Current ISO date (YYYY-MM-DD) or null/empty when unset. */
    value: string | null;
    /** Called with a new ISO date when the user enters a complete MM/YY, or empty string when cleared. */
    onChange: (iso: string) => void;
    placeholder?: string;
}

/** Apply the MM/YY mask to the user's raw input as they type. */
function applyMask(raw: string): string {
    const digits = raw.replace(/\D/g, '').slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

/** True if the masked input is a complete, plausible MM/YY (month 1-12). */
function isCompleteMmYy(masked: string): boolean {
    const m = masked.match(/^(\d{2})\/(\d{2})$/);
    if (!m) return false;
    const month = parseInt(m[1], 10);
    return month >= 1 && month <= 12;
}

/** MM/YY -> YYYY-MM-DD (last day of that month). */
export function mmYyToISO(masked: string): string | null {
    if (!isCompleteMmYy(masked)) return null;
    const [mm, yy] = masked.split('/');
    const month = parseInt(mm, 10);
    const year = 2000 + parseInt(yy, 10);
    // `new Date(year, month, 0)` gives the last day of `month` (1-indexed)
    // because day 0 of next month rolls back one day.
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${mm}-${String(lastDay).padStart(2, '0')}`;
}

/** YYYY-MM-DD -> MM/YY (drops the day; year is 2-digit). */
export function isoToMmYy(iso: string | null | undefined): string {
    if (!iso) return '';
    const m = iso.match(/^(\d{4})-(\d{2})-\d{2}$/);
    if (!m) return '';
    return `${m[2]}/${m[1].slice(2)}`;
}

export function MonthYearField({ value, onChange, placeholder = 'MM/YY' }: Props) {
    const [masked, setMasked] = useState<string>(isoToMmYy(value));

    // Re-seed the masked input if the upstream `value` prop changes
    // outside our control (e.g. parent resets the form).
    useEffect(() => {
        setMasked(isoToMmYy(value));
    }, [value]);

    function handleChange(raw: string) {
        const next = applyMask(raw);
        setMasked(next);
        if (next === '') {
            onChange('');
            return;
        }
        const iso = mmYyToISO(next);
        if (iso) onChange(iso);
        // If incomplete (only 2 digits typed, etc.), don't push partial
        // state to the parent — wait until the user finishes typing the
        // year so callers don't see a half-formed ISO date.
    }

    return (
        <TextInput
            style={styles.input}
            value={masked}
            onChangeText={handleChange}
            keyboardType="number-pad"
            placeholder={placeholder}
            placeholderTextColor="#9c9ca0"
            maxLength={5}
            autoCapitalize="none"
            autoCorrect={false}
        />
    );
}

const styles = StyleSheet.create({
    input: {
        backgroundColor: '#fff',
        borderColor: '#e3e3e7',
        borderWidth: 1,
        borderRadius: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        fontSize: 16,
    },
});
