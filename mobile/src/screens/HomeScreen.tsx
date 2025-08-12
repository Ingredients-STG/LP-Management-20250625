import React, { useCallback } from 'react';
import { SafeAreaView, StyleSheet, View, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Text } from '../components/Themed';
import { useAssetsQuery } from '../api/assets';
import { useAuth } from '../auth/AuthContext';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

export default function HomeScreen() {
  const { isAuthenticated } = useAuth();
  const navigation = useNavigation<any>();
  const { data, isLoading, isError, refetch, isRefetching } = useAssetsQuery();

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) {
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
      }
    }, [isAuthenticated])
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Assets</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateAsset')}> 
          <Text style={{ color: '#0ea5e9', fontWeight: '600' }}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator /><Text>Loading...</Text></View>
      ) : isError ? (
        <View style={styles.center}><Text>Failed to load assets.</Text></View>
      ) : (
        <FlatList
          data={data || []}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => navigation.navigate('AssetDetails', { assetId: item.id })}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.assetBarcode || 'Unknown'}</Text>
                <Text style={styles.cardSubtitle}>{item.assetType} • {item.status}</Text>
                {item.wing ? <Text style={styles.cardMeta}>Wing: {item.wing}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  card: { padding: 12, borderRadius: 12, backgroundColor: '#f6f6f7' },
  cardTitle: { fontSize: 16, fontWeight: '600' },
  cardSubtitle: { marginTop: 2, color: '#4b5563' },
  cardMeta: { marginTop: 4, color: '#6b7280' }
});
