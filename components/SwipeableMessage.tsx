import React, { useRef } from "react";
import { View, Animated, PanResponder, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface SwipeableMessageProps {
  children: React.ReactNode;
  onSwipeRight: () => void;
  onSwipeLeft?: () => void;
  disabled?: boolean;
}

const SwipeableMessage: React.FC<SwipeableMessageProps> = ({
  children,
  onSwipeRight,
  onSwipeLeft,
  disabled = false,
}) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const swipeThreshold = 80;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,

      onMoveShouldSetPanResponder: (_, gesture) =>
        !disabled && Math.abs(gesture.dx) > 5,

      onPanResponderMove: (_, gesture) => {
        pan.x.setValue(gesture.dx);
      },

      onPanResponderRelease: (_, gestureState) => {
        if (Math.abs(gestureState.dx) > swipeThreshold) {
          if (gestureState.dx > 0) {
            onSwipeRight();
          } else if (onSwipeLeft) {
            onSwipeLeft();
          }
        }

        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
        }).start();
      },
    }),
  ).current;

  return (
    <View style={styles.container}>
      {/* Right swipe indicator */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.swipeIndicator,
          styles.replyIndicator,
          {
            opacity: pan.x.interpolate({
              inputRange: [0, 50, 100],
              outputRange: [0, 0.3, 0.8],
              extrapolate: "clamp",
            }),
          },
        ]}
      >
        <Ionicons name="arrow-undo" size={20} color="#4A90E2" />
        <Animated.Text
          style={[
            styles.indicatorText,
            {
              opacity: pan.x.interpolate({
                inputRange: [30, 80],
                outputRange: [0, 1],
                extrapolate: "clamp",
              }),
            },
          ]}
        >
          Reply
        </Animated.Text>
      </Animated.View>

      {/* Message */}
      <Animated.View
        style={{ transform: [{ translateX: pan.x }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>

      {/* Left swipe indicator */}
      {onSwipeLeft && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.swipeIndicator,
            styles.copyIndicator,
            {
              opacity: pan.x.interpolate({
                inputRange: [-100, -50, 0],
                outputRange: [0.8, 0.3, 0],
                extrapolate: "clamp",
              }),
            },
          ]}
        >
          <Ionicons name="copy" size={20} color="#666" />
          <Animated.Text style={styles.indicatorText}>Copy</Animated.Text>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  copyIndicator: {
    right: 12,
  },
  indicatorText: {
    color: "#4A90E2",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  replyIndicator: {
    left: 12,
  },
  swipeIndicator: {
    alignItems: "center",
    bottom: 0,
    flexDirection: "row",
    justifyContent: "center",
    position: "absolute",
    top: 0,
  },
});

export default SwipeableMessage;
