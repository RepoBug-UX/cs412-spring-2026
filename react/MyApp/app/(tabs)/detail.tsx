import { Image, Text, ScrollView } from 'react-native';
import { styles } from '../../assets/my_styles';

export default function DetailScreen() {
  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <Text style={styles.titleText}>Snowboarding</Text>
      <Text style={styles.bodyText}>
        Snowboarding is one of the most exhilarating winter sports in the world.
        Whether you're a beginner learning to connect turns or an expert hitting
        backcountry terrain, there's always something new to try out.
      </Text>

      <Text style={styles.sectionTitle}>The Mountains</Text>
      <Text style={styles.sectionText}>
        The best snowboarding destinations offer a mix of groomed runs, powder 
        bowls, and challenging terrain parks. From the Rockies to the Alps, each
        mountain has its own personality and unique character. My personal home
        mountain is Mammoth Mtn in California.
      </Text>
      <Image
        source={{ uri: 'https://cs-people.bu.edu/gginsber/imgs/mam.JPG' }}
        style={styles.image}
      />

      <Text style={styles.sectionTitle}>Interesting Trails</Text>
      <Text style={styles.sectionText}>
        Some of the most memorable runs are the ones that take you off the beaten path.
        Tree-lined glades require quick reflexes and tight turns as you weave between
        the pines — the forest muffles the wind and creates a surreal, quiet ride.
        Wide open carving trails are the opposite experience: pure speed, long arcing
        turns, and the satisfying crunch of edge on groomed corduroy.
      </Text>
      <Image
        source={{ uri: 'https://cs-people.bu.edu/gginsber/imgs/tre.jpeg' }}
        style={styles.image}
      />

      <Text style={styles.sectionTitle}>Learning & Progression</Text>
      <Text style={styles.sectionText}>
        Improving as a snowboarder is a constant, rewarding process. Early on, the
        focus is on linking turns and building confidence on blue runs. As you progress,
        you start exploring steeper terrain, learning to read the snow, and working on
        technique. Taking a lesson or sending it with more experienced friends can 
        accelerate your improvement dramatically. 
      </Text>
      <Image
        source={{ uri: 'https://cs-people.bu.edu/gginsber/imgs/bot.jpg' }}
        style={styles.image}
      />
    </ScrollView>
  );
}
