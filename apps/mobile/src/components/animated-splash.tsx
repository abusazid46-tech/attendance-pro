import { useEffect, useRef } from "react";
import { Animated, ImageBackground, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme";

type AnimatedSplashProps = {
  onDone: () => void;
};

export function AnimatedSplash({ onDone }: AnimatedSplashProps) {
  const opacity = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(0.94)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardScale, {
        toValue: 1,
        friction: 7,
        tension: 70,
        useNativeDriver: true
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 520,
        useNativeDriver: true
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true
          }),
          Animated.timing(shimmer, {
            toValue: 0,
            duration: 900,
            useNativeDriver: true
          })
        ])
      )
    ]).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 420,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) onDone();
      });
    }, 1850);

    return () => clearTimeout(timer);
  }, [cardOpacity, cardScale, onDone, opacity, shimmer]);

  const shimmerTranslate = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120]
  });

  return (
    <Animated.View pointerEvents="none" style={[styles.overlay, { opacity }]}>
      <ImageBackground source={require("../../assets/splash.png")} resizeMode="cover" style={styles.background}>
        <Animated.View style={[styles.brand, { opacity: cardOpacity, transform: [{ scale: cardScale }] }]}>
          <Text style={styles.title}>Attendance Pro</Text>
          <Text style={styles.subtitle}>Smart Attendance Assistant</Text>
          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressGlow, { transform: [{ translateX: shimmerTranslate }] }]} />
            <View style={styles.progressFill} />
          </View>
        </Animated.View>
      </ImageBackground>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 999,
    backgroundColor: "#eefdf4"
  },
  background: {
    flex: 1,
    justifyContent: "flex-end"
  },
  brand: {
    paddingHorizontal: 28,
    paddingBottom: 58,
    gap: 8
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  progressTrack: {
    height: 8,
    marginTop: 16,
    overflow: "hidden",
    borderRadius: 999,
    backgroundColor: "rgba(22, 163, 74, 0.16)"
  },
  progressFill: {
    width: "68%",
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary
  },
  progressGlow: {
    position: "absolute",
    left: "35%",
    top: 0,
    width: 90,
    height: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.65)"
  }
});
