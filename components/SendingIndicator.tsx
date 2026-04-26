import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";

interface SendingIndicatorProps {
  isSending: boolean;
}

const SendingIndicator: React.FC<SendingIndicatorProps> = ({ isSending }) => {
  const dot1Anim = useRef(new Animated.Value(0)).current;
  const dot2Anim = useRef(new Animated.Value(0)).current;
  const dot3Anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isSending) {
      const createAnimation = (anim: Animated.Value) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 1,
              duration: 400,
              useNativeDriver: true,
            }),
            Animated.timing(anim, {
              toValue: 0,
              duration: 400,
              useNativeDriver: true,
            }),
          ]),
        );
      };

      Animated.stagger(150, [
        createAnimation(dot1Anim),
        createAnimation(dot2Anim),
        createAnimation(dot3Anim),
      ]).start();
    } else {
      [dot1Anim, dot2Anim, dot3Anim].forEach((anim) => {
        anim.stopAnimation();
        anim.setValue(0);
      });
    }
  }, [isSending]);

  const getDotStyle = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.5, 1],
        }),
      },
    ],
  });

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, getDotStyle(dot1Anim)]} />
      <Animated.View style={[styles.dot, getDotStyle(dot2Anim)]} />
      <Animated.View style={[styles.dot, getDotStyle(dot3Anim)]} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  dot: {
    backgroundColor: "#999",
    borderRadius: 2,
    height: 4,
    marginHorizontal: 2,
    width: 4,
  },
});

export default SendingIndicator;
