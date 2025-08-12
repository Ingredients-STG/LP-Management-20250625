import React from 'react';
import { SafeAreaView, StyleSheet, View, ScrollView } from 'react-native';
import { Text } from '../components/Themed';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useAssetQuery } from '../api/assets';
import { Button } from '../components/Themed';

export default function AssetDetailsScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { assetId } = route.params as { assetId: string };
  const { data: asset, isLoading } = useAssetQuery(assetId);

  if (isLoading || !asset) {
    return (
      <SafeAreaView style={styles.container}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>{asset.assetBarcode}</Text>
        <Text>{asset.assetType} • {asset.status}</Text>
        {asset.wing ? <Text>Wing: {asset.wing}</Text> : null}
        {asset.roomName ? <Text>Room: {asset.roomName}</Text> : null}
        {asset.notes ? <Text>Notes: {asset.notes}</Text> : null}

        <View style={{ height: 12 }} />
        <Button title="Edit" onPress={() => navigation.navigate('EditAsset', { assetId })} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 }
});
