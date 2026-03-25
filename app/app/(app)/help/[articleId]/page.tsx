interface HelpArticlePageProps {
  params: Promise<{ articleId: string }>;
}

export default async function HelpArticlePage({ params }: HelpArticlePageProps) {
  const { articleId } = await params;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Help Article
      </h1>
      <p className="text-gray-600 dark:text-gray-400">
        Article ID: {articleId}
      </p>
    </div>
  );
}
