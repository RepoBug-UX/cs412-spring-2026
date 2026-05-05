import React, { useState, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { styles } from '../../assets/styles/my_styles';

const API_BASE = 'http://127.0.0.1:8000/dadjokes';

export default function JokeListScreen() {
  const [jokes, setJokes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJokes = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/jokes`);
      const data = await response.json();
      // Handle paginated response from DRF
      setJokes(data.results || data);
    } catch (error) {
      console.log('Error fetching jokes:', error);
    }
    setLoading(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchJokes();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer}>
      <Text style={styles.titleText}>All Dad Jokes</Text>
      {jokes.map((joke: any) => (
        <View key={joke.id} style={styles.jokeCard}>
          <Text style={styles.jokeCardText}>"{joke.text}"</Text>
          <Text style={styles.jokeCardContributor}>- {joke.contributor}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
