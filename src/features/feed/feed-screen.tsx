import type { Post } from './api';
import { FlashList } from '@shopify/flash-list';
import { Link } from 'expo-router';

import * as React from 'react';
import {
  EmptyList,
  FocusAwareStatusBar,
  Pressable,
  SafeAreaView,
  Text,
  View,
} from '@/components/ui';
import { translate } from '@/lib/i18n';
import { ROUTES } from '@/lib/navigation';
import { usePosts } from './api';
import { PostCard } from './components/post-card';

/**
 * The native tab bar has no header slot, so this screen draws its own. It used
 * to come from the `headerRight` option on the expo-router `<Tabs.Screen>`.
 *
 * The app is edge-to-edge (react-native-edge-to-edge), so without the top inset
 * this row draws under the status bar and the system swallows taps on "Create".
 * Only the top edge is claimed: the native tab bar owns the bottom one, and the
 * row's horizontal padding is a design choice rather than an inset.
 */
function FeedHeader() {
  return (
    <SafeAreaView edges={['top']}>
      <View className="flex-row items-center justify-between px-4 py-3">
        <Text className="text-xl font-bold">{translate('feed.title')}</Text>
        <Link href={ROUTES.addPost} asChild>
          <Pressable testID="create-post-link">
            <Text className="text-primary-300">{translate('feed.create')}</Text>
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

export function FeedScreen() {
  const { data, isPending, isError } = usePosts();
  const renderItem = React.useCallback(
    ({ item }: { item: Post }) => <PostCard {...item} />,
    [],
  );

  if (isError) {
    return (
      <View>
        <Text> Error Loading data </Text>
      </View>
    );
  }
  return (
    <View className="flex-1">
      <FocusAwareStatusBar />
      <FeedHeader />
      <FlashList
        data={data}
        renderItem={renderItem}
        keyExtractor={(_, index) => `item-${index}`}
        ListEmptyComponent={<EmptyList isLoading={isPending} />}
      />
    </View>
  );
}
