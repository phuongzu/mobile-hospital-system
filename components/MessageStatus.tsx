import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface MessageStatusProps {
  status: "sending" | "sent" | "delivered" | "read" | "failed";
  timestamp?: string;
  isMyMessage: boolean;
}

const MessageStatus: React.FC<MessageStatusProps> = ({
  status,
  timestamp,
  isMyMessage,
}) => {
  const getStatusIcon = () => {
    if (!isMyMessage) return null;

    switch (status) {
      case "sending":
        return <Ionicons name="time-outline" size={14} color="#999" />;
      case "sent":
        return <Ionicons name="checkmark" size={14} color="#999" />;
      case "delivered":
        return (
          <View style={styles.doubleCheck}>
            <Ionicons name="checkmark" size={14} color="#999" />
            <Ionicons
              name="checkmark"
              size={14}
              color="#999"
              style={styles.secondCheck}
            />
          </View>
        );
      case "read":
        return (
          <View style={styles.doubleCheck}>
            <Ionicons name="checkmark" size={14} color="#4A90E2" />
            <Ionicons
              name="checkmark"
              size={14}
              color="#4A90E2"
              style={styles.secondCheck}
            />
          </View>
        );
      case "failed":
        return <Ionicons name="alert-circle" size={14} color="#FF3B30" />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {timestamp && <Text style={styles.timestamp}>{timestamp}</Text>}
      {getStatusIcon()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    gap: 4,
  },
  doubleCheck: {
    flexDirection: "row",
  },
  secondCheck: {
    marginLeft: -8,
  },
  timestamp: {
    color: "#666",
    fontSize: 11,
    marginRight: 4,
  },
});

export default MessageStatus;
