import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  scrollContainer: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  titleText: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 8,
    color: '#1a1a1a',
    textAlign: 'center',
  },
  subtitleText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
    textAlign: 'center',
  },
  bodyText: {
    fontSize: 15,
    color: '#333',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 24,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  sectionText: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  image: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginVertical: 12,
  },
  profileImage: {
    width: 160,
    height: 160,
    borderRadius: 80,
    marginVertical: 20,
  },
  separator: {
    height: 1,
    width: '100%',
    backgroundColor: '#e0e0e0',
    marginVertical: 16,
  },
});
