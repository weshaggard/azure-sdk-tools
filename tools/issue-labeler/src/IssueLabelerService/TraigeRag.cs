// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

using Azure.Search.Documents;
using Microsoft.Extensions.Logging;
using Azure.Search.Documents.Models;
using OpenAI.Chat;
using Azure.Search.Documents.Indexes;
using System.Threading.Tasks;
using System.Collections.Generic;
using System;
using Azure.AI.OpenAI;

namespace IssueLabelerService
{
    public class TriageRag
    {
        private static AzureOpenAIClient s_openAiClient;
        private static SearchIndexClient s_searchIndexClient;
        private ILogger<TriageRag> _logger;

        public TriageRag(ILogger<TriageRag> logger, AzureOpenAIClient openAiClient, SearchIndexClient searchIndexClient)
        {
            s_openAiClient = openAiClient;
            _logger = logger;
            s_searchIndexClient = searchIndexClient;
        }

        public async Task<List<IndexContent>> IssueTriageContentIndexAsync(
            string indexName,
            string semanticConfigName,
            string field,
            string query,
            int count,
            double scoreThreshold,
            Dictionary<string, string> labels = null)
        {

            var searchResults = await AzureSearchQueryAsync<IndexContent>(
                indexName,
                semanticConfigName,
                field,
                query,
                count
            );

            var filteredIssues = new List<IndexContent>();

            foreach (var (issue, score) in searchResults)
            {
                if (score >= scoreThreshold)
                {
                    issue.Score = score;
                    filteredIssues.Add(issue);
                }
            }
            
            return filteredIssues;
        }

        public async Task<List<(T, double)>> AzureSearchQueryAsync<T>(
            string indexName,
            string semanticConfigName,
            string field,
            string query,
            int count,
            string filter = null)
        {
            SearchClient searchClient = s_searchIndexClient.GetSearchClient(indexName);

            _logger.LogInformation($"Searching for related {typeof(T).Name.ToLower()}s...");
            SearchOptions options = new SearchOptions
            {
                Size = count,
                QueryType = SearchQueryType.Semantic
            };

            options.VectorSearch = new()
            {
                Queries =
                {
                    new VectorizableTextQuery(text: query)
                    {
                        KNearestNeighborsCount = 50,
                        Fields = { field }
                    }
                }
            };

            options.SemanticSearch = new()
            {
                SemanticConfigurationName = semanticConfigName
            };

            options.Filter = filter;

            SearchResults<T> response = await searchClient.SearchAsync<T>(
                query,
                options);

            _logger.LogInformation($"{typeof(T).Name}s found.");

            List<(T, double)> results = new List<(T, double)>();
            foreach (SearchResult<T> result in response.GetResults())
            {
                results.Add((result.Document, result.SemanticSearch.RerankerScore ?? 0.0));
            }

            return results;
        }

        public async Task<string> SendMessageQnaAsync(string instructions, string message, string modelName, string contextBlock = null, BinaryData structure = null)
        {
            _logger.LogInformation($"\n\nWaiting for an Open AI response...");
            ChatClient chatClient = s_openAiClient.GetChatClient(modelName);
            
            ChatCompletionOptions options = new ChatCompletionOptions();

            if (modelName.Contains("gpt"))
            {
                options.Temperature = 0;
            }

            if (modelName.Contains("o3-mini"))
            {
                options.ReasoningEffortLevel = ChatReasoningEffortLevel.Medium;
            }

            if (structure != null)
            {
                options.ResponseFormat = ChatResponseFormat.CreateJsonSchemaFormat(
                    jsonSchemaFormatName: "IssueOutput",
                    jsonSchema: structure
                );
            }

            var chatMessages = new List<ChatMessage>
            {
                new DeveloperChatMessage(instructions),
                new UserChatMessage(message)
            };

            if (contextBlock != null)
            {
                chatMessages.Add(new AssistantChatMessage(contextBlock));
            }

            ChatCompletion result = await chatClient.CompleteChatAsync(chatMessages, options);

            _logger.LogInformation($"\n\nFinished loading Open AI response.");

            return result.Content[0].Text;
        }
    }
}
