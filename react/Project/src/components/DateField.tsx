// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Cross-platform date picker for the expense create/edit
//              forms. Wraps @react-native-community/datetimepicker so
//              the parent screens can stay declarative — pass `value`
//              as a YYYY-MM-DD string and `onChange` as a setter, and
//              the wrapper handles the platform divergence:
//
//                - iOS: spinner-wheel inline beneath a tap-to-toggle
//                  trigger button. "Done" hides it again.
//                - Android: tap the trigger -> native calendar dialog,
//                  closes on selection or Cancel.
//
//              The user gets two distinct flavors of UX (wheel vs
//              calendar) — both are platform-natural, neither was
//              built from scratch, and the parent screens are blissful
//              about which platform they're on.

import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

interface Props {
    /** Current YYYY-MM-DD; pass the empty string to start with today's date. */
    value: string;
    onChange: (iso: string) => void;
    placeholder?: string;
}

/** Build today as YYYY-MM-DD; used as the picker's seed when value is blank. */
function todayISO(): string {
    const d = new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

/** YYYY-MM-DD -> Date at local midnight, suitable for the picker's `value`. */
function isoToDate(iso: string): Date {
    if (!iso) return new Date();
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return new Date();
    // Months are 0-indexed in the Date constructor.
    return new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
}

function dateToISO(d: Date): string {
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
}

export function DateField({ value, onChange, placeholder = 'Select a date' }: Props) {
    const [show, setShow] = useState(false);

    function handlePickerChange(event: DateTimePickerEvent, selected?: Date) {
        // Android's dialog dispatches `set` (with a date) or `dismissed`
        // (without). Either way, the picker closes when the user taps a
        // button — we just hide our local copy here too.
        if (Platform.OS !== 'ios') {
            setShow(false);
        }
        if (event.type === 'dismissed' || !selected) return;
        onChange(dateToISO(selected));
    }

    const display = value || placeholder;
    const isoForPicker = value || todayISO();

    return (
        <View>
            <Pressable
                onPress={() => setShow((s) => !s)}
                style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
            >
                <Text style={value ? styles.triggerValue : styles.triggerPlaceholder}>
                    {display}
                </Text>
            </Pressable>

            {show && (
                <View style={Platform.OS === 'ios' ? styles.iosPickerWrap : null}>
                    <DateTimePicker
                        value={isoToDate(isoForPicker)}
                        mode="date"
                        // iOS gets the spinner wheel inline; Android gets the
                        // native calendar dialog (the "default" display).
                        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                        onChange={handlePickerChange}
                    />
                    {Platform.OS === 'ios' && (
                        <Pressable
                            onPress={() => setShow(false)}
                            style={({ pressed }) => [styles.iosDone, pressed && styles.triggerPressed]}
                        >
                            <Text style={styles.iosDoneText}>Done</Text>
                        </Pressable>
                    )}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    trigger: {
        backgroundColor: '#fff',
        borderColor: '#e3e3e7',
        borderWidth: 1,
        borderRadius: 6,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    triggerPressed: {
        opacity: 0.7,
    },
    triggerValue: {
        fontSize: 16,
        color: '#1c1c1e',
    },
    triggerPlaceholder: {
        fontSize: 16,
        color: '#9c9ca0',
    },
    iosPickerWrap: {
        backgroundColor: '#fff',
        borderColor: '#e3e3e7',
        borderWidth: 1,
        borderRadius: 6,
        marginTop: 8,
        alignItems: 'center',
        paddingVertical: 6,
    },
    iosDone: {
        alignSelf: 'flex-end',
        paddingVertical: 6,
        paddingHorizontal: 14,
    },
    iosDoneText: {
        color: '#2b6cb0',
        fontSize: 16,
        fontWeight: '600',
    },
});
