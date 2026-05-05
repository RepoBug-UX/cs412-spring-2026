import { Image, View, Text } from 'react-native';
import { styles } from '../../assets/my_styles';

export default function AboutScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>About Me</Text>
      <Image
        source={{ uri: 'https://cs-people.bu.edu/gginsber/imgs/gab.jpeg' }}
        style={styles.profileImage}
      />
      <Text style={styles.subtitleText}>Gabriel</Text>
      <View style={styles.separator} />
      <Text style={styles.bodyText}>
        I'm a computer science student at the Boston University (BU) that
        is passionate about building software and exploring my interests.
      </Text>
      <Text style={styles.bodyText}>
        Outside of school, snowboarding is my favorite activities. I enjoy 
        Carving it up, exploring new resorts, and sharing the fresh powder
        with friends on the mountain.
      </Text>
    </View>
  );
}
