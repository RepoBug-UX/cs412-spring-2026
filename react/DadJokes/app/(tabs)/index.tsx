import React, { useState, useEffect } from 'react';
import { View, Text, Image, Pressable, ActivityIndicator } from 'react-native';
import { styles } from '../../assets/styles/my_styles';

const API_BASE = 'http://127.0.0.1:8000/dadjokes';

export default function IndexScreen() {
  const [joke, setJoke] = useState<any>(null);
  const [picture, setPicture] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchRandom = async () => {
    setLoading(true);
    try {
      const [jokeRes, picRes] = await Promise.all([
        fetch(`${API_BASE}/api/random`),
        fetch(`${API_BASE}/api/random_picture`),
      ]);
      const jokeData = await jokeRes.json();
      const picData = await picRes.json();
      setJoke(jokeData);
      setPicture(picData);
    } catch (error) {
      console.log('Error fetching random data:', error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRandom();
  }, []);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>Dad Joke of the Moment</Text>

      {joke && (
        <>
          <Text style={styles.jokeText}>"{joke.text}"</Text>
          <Text style={styles.contributorText}>- {joke.contributor}</Text>
        </>
      )}

      {picture && (
        <>
          <Image source={{ uri: picture.image_url }} style={styles.image} />
          <Text style={styles.contributorText}>Pic by {picture.contributor}</Text>
        </>
      )}

      <Pressable style={styles.refreshButton} onPress={fetchRandom}>
        <Text style={styles.buttonText}>Get Another!</Text>
      </Pressable>
    </View>
  );
}
