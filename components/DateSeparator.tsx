import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface DateSeparatorProps {
  date: string;
}

const DateSeparator: React.FC<DateSeparatorProps> = ({ date }) => {
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return "Today";
    } else if (date.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else if (date.getFullYear() === today.getFullYear()) {
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        weekday: "short",
      });
    } else {
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.line} />
      <Text style={styles.dateText}>{formatDate(date)}</Text>
      <View style={styles.line} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    marginVertical: 16,
    paddingHorizontal: 12,
  },
  dateText: {
    backgroundColor: "#FFF",
    color: "#666",
    fontSize: 13,
    fontWeight: "600",
    marginHorizontal: 12,
    paddingHorizontal: 8,
  },
  line: {
    backgroundColor: "#E0E0E0",
    flex: 1,
    height: 1,
  },
});

export default DateSeparator;
