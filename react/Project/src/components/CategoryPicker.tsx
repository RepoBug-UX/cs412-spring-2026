// Name: Gabriel Ginsberg
// Email: gginsber@bu.edu
// Description: Reusable Category picker — replaces the multi-row chip
//              picker that used to fill a third of the expense form.
//              Renders a single trigger button showing the current
//              selection; tapping it opens a Modal with a two-level
//              cascade. Top level: the five standalone categories plus
//              a "Subscriptions" parent row; tapping Subscriptions
//              slides the modal to the second level (Entertainment /
//              SaaS / Lifestyle / Professional). Selection commits and
//              dismisses the modal in a single tap.
//
//              Per design D5 the schema stays flat — the four
//              `Subscriptions — *` rows already exist as siblings, we
//              just present them as if they were children to keep the
//              picker tidy.

import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useMemo, useState } from 'react';
import {
    Modal,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { Category } from '@/src/api/types';

/** Prefix that marks a Subscriptions sub-category in the seeded data. */
const SUBSCRIPTIONS_PREFIX = 'Subscriptions —';

interface Props {
    categories: Category[];
    selectedId: number | null;
    onSelect: (id: number) => void;
    /** Optional placeholder shown when nothing is selected yet. */
    placeholder?: string;
}

/**
 * Strip the "Subscriptions —" prefix from a sub-category name so the
 * second-level rows read cleanly as "Entertainment" / "SaaS" / etc.
 */
function shortName(category: Category): string {
    if (category.name.startsWith(SUBSCRIPTIONS_PREFIX)) {
        return category.name.slice(SUBSCRIPTIONS_PREFIX.length).trim();
    }
    return category.name;
}

export function CategoryPicker({ categories, selectedId, onSelect, placeholder = 'Choose a category' }: Props) {
    const [open, setOpen] = useState(false);
    const [view, setView] = useState<'top' | 'subscriptions'>('top');

    /**
     * Group categories into the standalone top-level set vs the
     * Subscriptions sub-set. Memoized because the categories array is
     * stable but we still don't want to re-partition on every render.
     */
    const { standalone, subscriptions } = useMemo(() => {
        const subs: Category[] = [];
        const top: Category[] = [];
        for (const cat of categories) {
            if (cat.name.startsWith(SUBSCRIPTIONS_PREFIX)) {
                subs.push(cat);
            } else {
                top.push(cat);
            }
        }
        return { standalone: top, subscriptions: subs };
    }, [categories]);

    const selected = categories.find((c) => c.id === selectedId) ?? null;

    function commit(id: number) {
        onSelect(id);
        setOpen(false);
        // Reset to top-level so the modal opens fresh next time.
        setView('top');
    }

    function close() {
        setOpen(false);
        setView('top');
    }

    return (
        <>
            {/* Trigger button: shows the current selection or placeholder. */}
            <Pressable
                onPress={() => setOpen(true)}
                style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
            >
                <Text style={selected ? styles.triggerValue : styles.triggerPlaceholder}>
                    {selected ? selected.name : placeholder}
                </Text>
                <FontAwesome name="chevron-down" size={12} color="#6c6c70" />
            </Pressable>

            <Modal
                visible={open}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={close}
            >
                <SafeAreaView style={styles.modalSafeArea}>
                    <View style={styles.modalHeader}>
                        {view === 'subscriptions' ? (
                            <Pressable onPress={() => setView('top')} hitSlop={12}>
                                <Text style={styles.modalHeaderAction}>← Back</Text>
                            </Pressable>
                        ) : (
                            <View style={{ width: 60 }} />
                        )}
                        <Text style={styles.modalTitle}>
                            {view === 'top' ? 'Categories' : 'Subscriptions'}
                        </Text>
                        <Pressable onPress={close} hitSlop={12}>
                            <Text style={styles.modalHeaderAction}>Cancel</Text>
                        </Pressable>
                    </View>

                    <ScrollView contentContainerStyle={styles.modalBody}>
                        {view === 'top' ? (
                            <>
                                {standalone.map((cat) => (
                                    <CategoryRow
                                        key={cat.id}
                                        label={cat.name}
                                        isSelected={selectedId === cat.id}
                                        onPress={() => commit(cat.id)}
                                    />
                                ))}
                                {subscriptions.length > 0 && (
                                    <CategoryRow
                                        label="Subscriptions"
                                        accessory="chevron"
                                        // Mark as "current branch" if the selection
                                        // is one of the subscription children.
                                        isCurrentBranch={subscriptions.some((s) => s.id === selectedId)}
                                        onPress={() => setView('subscriptions')}
                                    />
                                )}
                            </>
                        ) : (
                            subscriptions.map((cat) => (
                                <CategoryRow
                                    key={cat.id}
                                    label={shortName(cat)}
                                    isSelected={selectedId === cat.id}
                                    onPress={() => commit(cat.id)}
                                />
                            ))
                        )}
                    </ScrollView>
                </SafeAreaView>
            </Modal>
        </>
    );
}

interface CategoryRowProps {
    label: string;
    onPress: () => void;
    isSelected?: boolean;
    /** Highlight this row to indicate the current selection lives within it. */
    isCurrentBranch?: boolean;
    accessory?: 'chevron';
}

function CategoryRow({ label, onPress, isSelected, isCurrentBranch, accessory }: CategoryRowProps) {
    return (
        <Pressable
            onPress={onPress}
            style={({ pressed }) => [
                styles.row,
                (isSelected || isCurrentBranch) && styles.rowSelected,
                pressed && styles.rowPressed,
            ]}
        >
            <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]}>{label}</Text>
            {accessory === 'chevron' ? (
                <FontAwesome name="chevron-right" size={14} color="#6c6c70" />
            ) : isSelected ? (
                <FontAwesome name="check" size={16} color="#2b6cb0" />
            ) : null}
        </Pressable>
    );
}

const styles = StyleSheet.create({
    trigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
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
        flexShrink: 1,
        marginRight: 8,
    },
    triggerPlaceholder: {
        fontSize: 16,
        color: '#9c9ca0',
        flexShrink: 1,
        marginRight: 8,
    },
    modalSafeArea: {
        flex: 1,
        backgroundColor: '#f7f7f9',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#e3e3e7',
        backgroundColor: '#fff',
    },
    modalHeaderAction: {
        color: '#2b6cb0',
        fontSize: 16,
        fontWeight: '600',
        minWidth: 60,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '700',
    },
    modalBody: {
        padding: 16,
        gap: 6,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#fff',
        borderRadius: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    rowSelected: {
        borderColor: '#2b6cb0',
        backgroundColor: '#ebf3fb',
    },
    rowPressed: {
        opacity: 0.7,
    },
    rowLabel: {
        fontSize: 16,
        color: '#1c1c1e',
        flexShrink: 1,
    },
    rowLabelSelected: {
        color: '#2b6cb0',
        fontWeight: '600',
    },
});
