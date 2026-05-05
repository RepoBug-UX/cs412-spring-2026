import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, Alert } from 'react-native';
import { styles } from '../../assets/styles/my_styles';

const API_BASE = 'http://127.0.0.1:8000/dadjokes';

export default function AddJokeScreen() {
  const [text, setText] = useState('');
  const [contributor, setContributor] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim() || !contributor.trim()) {
      setMessage('Please fill in both fields.');
      setIsError(true);
      return;
    }

    console.log('Submitting joke:', { text, contributor });

    try {
      const response = await fetch(`${API_BASE}/api/jokes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, contributor }),
      });

      console.log('Response status:', response.status);

      if (response.status === 201) {
        setMessage('Joke added successfully!');
        setIsError(false);
        setText('');
        setContributor('');
      } else {
        setMessage('Failed to add joke. Please try again.');
        setIsError(true);
      }
    } catch (error) {
      console.log('Error posting joke:', error);
      setMessage('Network error. Is the server running?');
      setIsError(true);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>Add a Dad Joke</Text>

      <Text style={styles.label}>Joke Text:</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={text}
        onChangeText={setText}
        placeholder="Enter your dad joke..."
        multiline
      />

      <Text style={styles.label}>Your Name:</Text>
      <TextInput
        style={styles.input}
        value={contributor}
        onChangeText={setContributor}
        placeholder="Enter your name..."
      />

      <Pressable style={styles.button} onPress={handleSubmit}>
        <Text style={styles.buttonText}>Submit Joke</Text>
      </Pressable>

      {message !== '' && (
        <Text style={isError ? styles.errorText : styles.successText}>
          {message}
        </Text>
      )}
    </View>
  );
}
