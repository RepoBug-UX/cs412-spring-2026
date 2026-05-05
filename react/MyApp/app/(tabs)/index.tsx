import { Image, View, Text, ScrollView } from 'react-native';
import { styles } from '../../assets/my_styles';

export default function IndexScreen() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Image
        source={require('../../assets/images/profilepic.jpeg')}
        style={styles.profileImage}
      />
      <Text style={styles.titleText}>Gabriel</Text>
      <Text style={styles.subtitleText}>CS @ BU | Builder | Snowboarder</Text>
      <View style={styles.separator} />
      <Text style={styles.bodyText}>
        Hi! I'm Gabriel, a computer science student at the Boston University.
        When I'm not coding, you'll find me on the mountain chasing fresh 
        powder and carving turns down the slopes.
      </Text>
      <Text style={styles.bodyText}>
        I started snowboarding a back in middle school and instantly fell in love with the
        sport. There's nothing quite like the feeling of gliding down a mountain, weaving
        through trees, and catching air off a jump.
      </Text>
    </ScrollView>
  );
}
